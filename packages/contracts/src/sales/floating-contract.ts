/** Saved Sales service facts: floating flights imply floating hotel purchase ownership. */
export function isFloatingSalesContract(
  services: readonly { kind: string; metadata?: unknown }[],
) {
  return services.some((service) => {
    const meta = service.metadata as Record<string, unknown> | null | undefined;
    return (
      (service.kind === 'FLIGHT' &&
        (meta?.contractFlightVersion === 1 ||
          meta?.purchaseSupplyType === 'FLOATING')) ||
      (service.kind === 'HOTEL' && meta?.purchaseSupplyType === 'FLOATING')
    );
  });
}
