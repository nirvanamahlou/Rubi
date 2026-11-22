(function () {
  const card = (key, label, i, width) => ({
    key, label, box: [158 + i * (width + 8), 1010, width, 80],
  });
  const base = {
    azarPoster: true,
    fixedCardSlots: true,
    width: 1024,
    height: 1280,
    font: 14,
    color: '#062b60',
    titleBox: [333, 28, 474, 83],
    date: [158, 140, 210, 45],
    durationBox: [385, 129, 470, 59],
    headerBox: [158, 208, 850, 33],
    body: [158, 242, 850, 753],
    servicesBox: [527, 1106, 481, 97],
    adjustmentsBox: [158, 1106, 356, 97],
  };
  window.TEMPLATES['antalya-airtour'] = {
    ...base,
    label: 'آنتالیا · ایران ایرتور',
    title: 'آنتالیا',
    style: 'antalya-airtour',
    artworkSource: 'antalya',
    rows: 32,
    columns: [26, 10, 20, 10, 11, 11, 12],
    cardSlots: [
      card('adult', 'هزینه پرواز', 0, 278),
      card('small', 'کودک بدون تخت', 1, 278),
      card('commission', 'کمیسیون', 2, 278),
    ],
  };
  window.TEMPLATES['malaysia-singapore-azar'] = {
    ...base,
    label: 'کوالالامپور + سنگاپور · ایران ایرتور',
    title: 'کوالالامپور + سنگاپور',
    style: 'malaysia-singapore-azar',
    artworkSource: 'malaysia-singapore',
    rows: 40,
    columns: [39, 9, 13, 13, 13, 13],
    cardSlots: [
      card('commission', 'کمیسیون', 0, 206),
      card('infant', 'نوزاد', 1, 206),
      card('childFlight', 'هزینه پرواز کودک', 2, 206),
      card('adult', 'هزینه پرواز بزرگسال', 3, 206),
    ],
  };
})();
