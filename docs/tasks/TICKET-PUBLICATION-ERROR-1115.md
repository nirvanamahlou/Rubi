# TICKET-PUBLICATION-ERROR-1115

The owner reported a failed Publish dialog. The client replaced every non-2xx response with a generic error. The actual selected ticket and saved Niyayesh destination were owned by HQ, while protected site configuration pointed at the Niyayesh branch. Both normal and newly created test offers were stored in HQ despite the active issuer caption.

The owner explicitly confirms that HQ is included in Niyayesh. Align the dedicated site's operational branch with actual HQ inventory; retain the existing Niyayesh membership and role permissions. Add only the required HQ membership with an IAM system audit. Preserve the protected signing secret, existing destination ID and all products/prices/customer/order ownership. No linked ERP orders existed outside HQ when the default was corrected. Site code/issuer caption is not an inventory branch identifier. Never infer or rewrite inventory ownership from a header label.

Authoritative configuration is /opt/rubi/private/site-commerce.env. Future releases must preserve it and validate branch/destination ownership before changing the binding. The publication row, sale destination and final native reservation must agree on that operational branch. No global service role expansion or impersonation is used. Existing site legacy orders remain separate.

The UI now displays nested API error.message and plain message explanations and retains a safe fallback for invalid/non-JSON errors. Errors never mark a resource as published; selection, cancellation and pause/unpublish behavior are retained. Ten focused interaction tests and the scoped production Web build pass. The runtime correction was verified healthy; hosted exact-head checks gate the UI merge and rollout.
