import { ConflictException, BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@nora/database';
import { createHash } from 'node:crypto';
import type { AuthenticatedActor } from '@nora/contracts';
import { liveCapacityHolds } from './live-capacity-holds';
import { checkoutSeatCount, assertCheckoutHoldReplay, type CheckoutCounts } from './checkout-hold-policy';

type Lease = { id:string; branchId:string; createdByUserId:string; requesterName:string; requesterPhone:string; expiresAt:Date };
/** Ticket Catalog alone mutates holds; callers authorize their checkout before entering this port. */
@Injectable()
export class CheckoutTicketCapacity {
  async lock(tx:Prisma.TransactionClient, ids:readonly string[]) {
    if(ids.length<1||ids.length>2||new Set(ids).size!==ids.length)throw new BadRequestException('انتخاب پرواز معتبر نیست.');
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "TicketPublishedOffer" WHERE "id" IN (${Prisma.join([...ids].sort())}) ORDER BY "id" FOR UPDATE`);
  }
  async prepare<T>(tx:Prisma.TransactionClient, lease:Lease, ids:readonly string[], counts:CheckoutCounts, quote:()=>Promise<{snapshot:T; fingerprints:Record<string,string>}>) {
    const quantity=checkoutSeatCount(counts), now=new Date();
    if(lease.expiresAt<=now || lease.expiresAt.getTime()>now.getTime()+600000 || !lease.requesterName.trim() || !lease.requesterPhone.trim())throw new BadRequestException('مهلت یا اطلاعات رزرو معتبر نیست.');
    await this.lock(tx,ids);
    const offers=await tx.ticketPublishedOffer.findMany({where:{id:{in:[...ids]},branchId:lease.branchId,status:'ACTIVE',departureAt:{gt:now}},include:{capacityAllocations:{where:{status:'ACTIVE'},select:{quantity:true}},capacityHolds:{where:liveCapacityHolds(now),select:{quantity:true}}}});
    if(offers.length!==ids.length || offers.some(o=>o.totalCapacity-o.capacityAllocations.reduce((n,a)=>n+a.quantity,0)-o.capacityHolds.reduce((n,h)=>n+h.quantity,0)<quantity))throw new ConflictException('ظرفیت کافی نیست؛ پرواز دیگری انتخاب کنید.');
    const result=await quote();
    for(const offerId of ids){
      const fingerprint=result.fingerprints[offerId];
      if(!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint))throw new BadRequestException('نرخ رزرو معتبر نیست.');
      await tx.ticketOfferCapacityHold.create({data:{offerId,branchId:lease.branchId,quantity,checkoutSessionId:lease.id,checkoutQuoteFingerprint:fingerprint,requesterName:lease.requesterName,requesterPhone:lease.requesterPhone,expiresAt:lease.expiresAt,createdByUserId:lease.createdByUserId,idempotencyKey:`checkout:${lease.id}:${offerId}`,fingerprint:createHash('sha256').update(JSON.stringify([lease.id,offerId,quantity,lease.expiresAt.toISOString(),fingerprint])).digest('hex')}});
    }
    return result.snapshot;
  }
  async pin(tx:Prisma.TransactionClient, sessionId:string, branchId:string, attemptKey:string) {
    if(!/^[A-Za-z0-9_.:-]{16,160}$/.test(attemptKey))throw new BadRequestException('شناسه تلاش پرداخت معتبر نیست.');
    const before=await tx.ticketOfferCapacityHold.findMany({where:{checkoutSessionId:sessionId,branchId}});
    await this.lock(tx,before.map(h=>h.offerId));
    const holds=await tx.ticketOfferCapacityHold.findMany({where:{checkoutSessionId:sessionId,branchId}});
    const now=new Date();
    assertCheckoutHoldReplay(holds,before.map(h=>h.offerId),before[0]?.quantity??0,now);
    if(holds.some(h=>h.paymentAttemptKey!==null&&h.paymentAttemptKey!==attemptKey))throw new ConflictException('نتیجه پرداخت قبلی هنوز مشخص نشده است.');
    await tx.ticketOfferCapacityHold.updateMany({where:{id:{in:holds.map(h=>h.id)},status:'ACTIVE',paymentPendingAt:null},data:{paymentPendingAt:now,paymentAttemptKey:attemptKey}});
  }
  async bind(tx:Prisma.TransactionClient, sessionId:string, branchId:string, contractId:string) {
    const holds=await tx.ticketOfferCapacityHold.findMany({where:{checkoutSessionId:sessionId,branchId}});
    await this.lock(tx,holds.map(h=>h.offerId));
    const current=await tx.ticketOfferCapacityHold.findMany({where:{checkoutSessionId:sessionId,branchId}});
    if(!current.length||current.some(h=>h.status!=='ACTIVE'||!h.paymentPendingAt||(h.checkoutContractId&&h.checkoutContractId!==contractId)))throw new ConflictException('رزرو قابل اتصال نیست.');
    await tx.ticketOfferCapacityHold.updateMany({where:{id:{in:current.map(h=>h.id)}},data:{checkoutContractId:contractId}});
  }
  async releaseFailed(tx:Prisma.TransactionClient, sessionId:string, branchId:string, attemptKey:string) {
    const holds=await tx.ticketOfferCapacityHold.findMany({where:{checkoutSessionId:sessionId,branchId}});
    await this.lock(tx,holds.map(h=>h.offerId));
    if(!holds.length||holds.some(h=>h.checkoutContractId||h.paymentAttemptKey!==attemptKey||!['ACTIVE','RELEASED'].includes(h.status)))throw new ConflictException('رزرو قابل آزادسازی نیست.');
    await tx.ticketOfferCapacityHold.updateMany({where:{checkoutSessionId:sessionId,branchId,status:'ACTIVE',paymentAttemptKey:attemptKey},data:{status:'RELEASED',releasedAt:new Date()}});
  }
  async roster(tx:Prisma.TransactionClient, offerId:string, actor:AuthenticatedActor) {
    if(!actor.permissions.includes('ticket_catalog.manage'))throw new ForbiddenException();
    const offer=await tx.ticketPublishedOffer.findFirst({where:{id:offerId,branchId:{in:actor.branchIds}},select:{branchId:true}});
    if(!offer)throw new ForbiddenException();
    return tx.ticketOfferCapacityHold.findMany({where:{offerId,branchId:offer.branchId,...liveCapacityHolds()},select:{id:true,quantity:true,requesterName:true,requesterPhone:true,createdAt:true,expiresAt:true,paymentPendingAt:true},orderBy:{createdAt:'asc'},take:101});
  }
  async roster(tx:Prisma.TransactionClient,offerId:string,actor:AuthenticatedActor){
    if(!actor.permissions.includes('ticket_catalog.manage'))throw new ForbiddenException('دسترسی نمایش رزروها ندارید.');
    const offer=await tx.ticketPublishedOffer.findFirst({where:{id:offerId,branchId:{in:actor.branchIds}},select:{id:true}});
    if(!offer)throw new ForbiddenException('پرواز در دسترس نیست.');
    return tx.ticketOfferCapacityHold.findMany({where:{offerId,...liveCapacityHolds()},orderBy:{createdAt:'desc'},take:101,select:{id:true,quantity:true,requesterName:true,requesterPhone:true,expiresAt:true,paymentPendingAt:true,createdAt:true}});
  }
}
