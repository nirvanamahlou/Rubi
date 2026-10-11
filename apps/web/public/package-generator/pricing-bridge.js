'use strict';
// A deliberately small, sale-only boundary. No storage, requests or credentials.
window.PackagePricingBridge = {
  normalize(input) {
    const text = (value, max = 240) => {
      if (typeof value !== 'string' || value.length > max) throw Error('Invalid package text');
      return value;
    };
    if (!input || !Array.isArray(input.groups) || !input.groups.length || input.groups.length > 500) throw Error('Invalid hotel table');
    return {
      sourceId: text(input.sourceId, 100), title: text(input.title), date: text(input.date), duration: text(input.duration),
      sheetName: 'قیمت منتشرشده پکیج', priceKeys: ['double', 'single', 'child'], hasRoom: true,
      cards: {}, notes: '', stays: '', adjustments: '', services: text(input.services || '',2000), warnings: [],
      groups: input.groups.map(group => {
        if (!Array.isArray(group.hotels) || group.hotels.length !== 1) throw Error('Invalid hotel');
        const hotel = group.hotels[0];
        return {
          hotels: [{hotel:text(hotel.hotel), room:text(hotel.room,1000), service:text(hotel.service), city:'', stars:''}],
          prices: Object.fromEntries(['single','double','child'].map(key => {
            const parts = group.prices?.[key]?.parts;
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
