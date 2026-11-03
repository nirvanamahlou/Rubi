'use strict';
// A deliberately small, sale-only boundary. No storage, requests or credentials.
window.PackagePricingBridge = {
  normalize(input) {
    const text = (value, max = 240) => {
      if (typeof value !== 'string' || value.length > max) throw Error('Invalid package text');
      return value;
    };
    if (!input || !Array.isArray(input.groups) || !input.groups.length || input.groups.length > 500) throw Error('Invalid hotel table');
    const compositionMode = input.version === 2;
    const priceKeys = compositionMode ? ['double','single'] : ['double','single','child'];
    const cards = {};
    const fields = input.priceFields ?? [];
    if (!Array.isArray(fields) || fields.length > 50) throw Error('Invalid footer prices');
    const keys = { adultFlight: 'adult', childFlight: 'childFlight', infantFlight: 'infant', business: 'business', commission: 'commission' };
    const seen = new Set();
    for (const field of fields) {
      if (!field || typeof field.amount !== 'string' || typeof field.currencyCode !== 'string' || !['fixed', 'percent'].includes(field.mode) || !/^(0|[1-9]\d{0,19})(\.\d{1,2})?$/.test(field.amount) || !/^[A-Z]{3}$/.test(field.currencyCode) || (field.mode !== 'percent' && field.currencyCode === 'IRR' && /\./.test(field.amount))) throw Error('Invalid footer price');
      if (field.mode === 'percent' && (field.kind !== 'commission' || Number(field.amount) > 100)) throw Error('Invalid footer percentage');
      const key = field.kind === 'custom' ? 'source_card_' + text(field.id,80) : Object.hasOwn(keys,field.kind) ? keys[field.kind] : '';
      if (!key || seen.has(key)) throw Error('Invalid footer field');
      seen.add(key);
      cards[key] = { label: text(field.title,120), value: field.amount, unit: field.mode === 'percent' ? '٪' : ({IRR:'ریال',EUR:'€',USD:'$'}[field.currencyCode] || field.currencyCode) };
    }
    return {
      sourceId: text(input.sourceId, 100), title: text(input.title), date: text(input.date), duration: text(input.duration),
      sheetName: 'قیمت منتشرشده پکیج', priceKeys, hasRoom: true,
      template: typeof input.template === 'string' && /^(?:antalya|kus|bodrum|istanbul-4|malaysia-(?:kuala|penang|langkawi|singapore)|thailand-(?:pattaya|phuket|bangkok-phuket))$/.test(input.template) ? input.template : '',
      cards, publishedFooterFields: true, notes: text(input.notes || '',10000), stays: '', adjustments: '', services: text(input.services || '',2000), warnings: [],
      groups: input.groups.map(group => {
        if (!Array.isArray(group.hotels) || group.hotels.length !== 1) throw Error('Invalid hotel');
        const hotel = group.hotels[0];
        return {
          hotels: [{hotel:text(hotel.hotel), room:text(hotel.room,1000), service:text(hotel.service), city:'', stars:''}],
          prices: Object.fromEntries(priceKeys.map(key => {
            const parts = group.prices?.[key]?.parts;
            if(compositionMode && parts === undefined) return [key,{value:'',currency:'',parts:[]}];
            if (!Array.isArray(parts) || !parts.length || parts.length > 50) throw Error('Invalid sale price');
            return [key,{value:'published',currency:'ISO',parts:parts.map(part => {
              if (!/^(0|[1-9]\d{0,23})(\.\d{1,2})?$/.test(part.amount) || !/^[A-Z]{3}$/.test(part.currencyCode) || (part.currencyCode === 'IRR' && /\./.test(part.amount))) throw Error('Invalid sale currency');
              return {amount:part.amount,currencyCode:part.currencyCode};
            })}];
          })),
        };
      }),
    };
  },
  connect(apply) {
    let sourceId = '';
    window.addEventListener('message', event => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'rubi-package-pricing') return;
      try {
        const data = this.normalize(event.data.data);
        if (data.sourceId === sourceId) return;
        apply(data);
        sourceId = data.sourceId;
      } catch (error) { console.error('Package pricing import failed', error); }
    });
    window.addEventListener('load', () => {
      if (window.parent !== window) window.parent.postMessage({type:'rubi-package-pricing-ready'},window.location.origin);
    }, {once:true});
  },
};
