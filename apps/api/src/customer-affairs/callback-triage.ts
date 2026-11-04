import type { TelephonyTechnical } from './telephony-state';
export { callbackManagers } from '../iam/call-center-answer-policy';
export function missedInbound(t: TelephonyTechnical) {
  return (
    t.first.direction === 'IN' &&
    t.state === 'ENDED' &&
    !t.lastAnswer &&
    !t.answers?.length
  );
}
export function ringingExtensions(t: TelephonyTechnical) {
  return [
    ...new Set(
      (t.destinations ?? [])
        .map((d) => d.extension)
        .filter((v): v is string => !!v),
    ),
  ];
}
