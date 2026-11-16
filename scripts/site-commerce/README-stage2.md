# Rubi sales connections

| Concern                        | Previous NSS dependency                                             | Scope used by Rubi                                                         |
| ------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Catalog HTTP delivery          | Single NSS timer, receiver, HMAC environment variable and state row | One timer per site, pinned HTTPS origin, separate secret and delivery row  |
| Flight rates                   | NSS-only target validation at publication and commission trigger    | Site + HQ branch + stable price target ID for publication, quote and order |
| Ticket airline logo            | NSS order lookup and NSS public asset URLs                          | Authenticated site account, linked contract, branch and site origin        |
| Contracts and travel documents | Existing order lookup                                               | Site + branch + external order ID before finance release checks            |
| Cancellation                   | Existing scoped cancellation lookup and trigger                     | Signed snapshot for the owning site and branch                             |
| Account                        | Stage-one provisioning selects site username and issuer             | Dedicated Jahan user, HQ primary, JAHAN_BASTAN secondary and issuer        |

## Configure after migration

1. Deploy the API and Prisma migration together. Keep the Jahan webhook key absent from the running API until its receiver is ready.
2. With the stage-one account bindings loaded, run `node scripts/site-commerce/configure-jahan-catalog.cjs` in the API container. It binds the unique active HQ target named «سایت جهان باستان». Subsequent runs retain its ID after renaming. Existing rates can be published from the ticket pricing screen.
3. For initial key generation only, add `--create-key` in a trusted container with persistent secret storage or securely transfer the file before recreating it. It creates `/root/jahan-bastan-catalog.env` exclusively with mode 0600. Alternatively provision an independent high-entropy secret through the deployment secret store.
4. Configure the receiver at `https://jahanbastan.ir/api/v1/erp/catalog-delivery` with that key. After the receiver is ready, load `JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET` into the Rubi API environment and recreate the API. NSS continues to use its existing key and URL.
5. Check the Jahan row in `website_catalog_deliveries`. `revision` is the pending source version, `attemptedRevision` the last dispatch attempt, `deliveredRevision` and `deliveredAt` the accepted revision and receipt time, and `lastError` the most recent unresolved error. A valid receipt clears it. No gateway or payment action is needed for this check.
