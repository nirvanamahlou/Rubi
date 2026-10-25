INSERT INTO iam_permissions (id,code,module,name) VALUES
(gen_random_uuid(),'floating_purchases.write.own','floating_purchases','ثبت خرید بلیط و هتل شناور قراردادهای خود'),
(gen_random_uuid(),'floating_purchases.read.all','floating_purchases','مشاهده خریدهای شناور همه فروشندگان'),
(gen_random_uuid(),'ui.screen.floating-purchases.hotels','ui','خرید هتل شناور'),
(gen_random_uuid(),'ui.allow.floating-purchases.hotels','ui','خرید هتل شناور'),
(gen_random_uuid(),'ui.screen.floating-purchases.flights','ui','خرید بلیط شناور'),
(gen_random_uuid(),'ui.allow.floating-purchases.flights','ui','خرید بلیط شناور')
ON CONFLICT (code) DO NOTHING;
