// A page may issue another search while the previous network call is in flight.
export function latestRequest() {
  let revision = 0;
  return {
    begin: () => ++revision,
    isCurrent: (value) => value === revision,
    cancel: () => { revision++; },
  };
}
