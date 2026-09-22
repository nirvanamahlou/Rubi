import type {
  CustomerDraftDto,
  DuplicateCandidateDto,
} from './customer.contracts';

export function validateCustomerDraft(draft: CustomerDraftDto) {
  const errors: Record<string, string> = {};
  if (draft.displayName.trim().length < 2)
    errors.displayName = 'نام نمایشی باید حداقل دو نویسه باشد.';
  if (!draft.firstName.trim()) errors.firstName = 'نام الزامی است.';
  if (!draft.lastName.trim()) errors.lastName = 'نام خانوادگی الزامی است.';
  if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email))
    errors.email = 'ایمیل معتبر نیست.';
  if (draft.primaryPhone && !/^\+?[0-9]{10,15}$/.test(draft.primaryPhone))
    errors.primaryPhone = 'شماره تماس باید ۱۰ تا ۱۵ رقم باشد.';
  if (
    draft.birthDate &&
    Number.isNaN(Date.parse(`${draft.birthDate}T00:00:00.000Z`))
  )
    errors.birthDate = 'تاریخ تولد معتبر نیست.';
  if (
    new Set(draft.companionCustomerIds).size !==
    draft.companionCustomerIds.length
  )
    errors.companionCustomerIds = 'همراه تکراری مجاز نیست.';
  return { valid: Object.keys(errors).length === 0, errors };
}

const normalize = (value: string | null | undefined) =>
  value?.trim().toLocaleLowerCase('fa-IR') ?? '';

export function detectDuplicateCandidate(
  incoming: CustomerDraftDto,
  existing: CustomerDraftDto & { id: string },
): DuplicateCandidateDto | null {
  const reasons: string[] = [];
  let score = 0;
  if (
    incoming.primaryPhone &&
    normalize(incoming.primaryPhone) === normalize(existing.primaryPhone)
  ) {
    score += 60;
    reasons.push('شماره تماس یکسان');
  }
  if (
    normalize(incoming.firstName) === normalize(existing.firstName) &&
    normalize(incoming.lastName) === normalize(existing.lastName)
  ) {
    score += 25;
    reasons.push('نام و نام خانوادگی یکسان');
  }
  if (incoming.birthDate && incoming.birthDate === existing.birthDate) {
    score += 15;
    reasons.push('تاریخ تولد یکسان');
  }
  return score < 50
    ? null
    : {
        candidateCustomerId: existing.id,
        score,
        reasons,
        reviewStatus: 'pending',
      };
}

export function maskContact(value: string | null) {
  if (!value) return null;
  if (value.length < 7) return '••••';
  return `${value.slice(0, 4)}•••${value.slice(-3)}`;
}
