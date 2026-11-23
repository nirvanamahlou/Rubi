/** Required at flight form submission; legacy records remain readable. */
export function requireFlightAirports(flight: {
  originAirportId?: string | null;
  destinationAirportId?: string | null;
}) {
  if (!flight.originAirportId || !flight.destinationAirportId)
    throw new Error('فرودگاه مبدأ و مقصد را انتخاب کنید.');
}
