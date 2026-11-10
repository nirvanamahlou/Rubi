# Gregorian flight date in reservation amendments

The owner requests the flight date in the reservation contract amendment to always use Gregorian. Previously it selected a default calendar from currently loaded origin/destination references, so the initial empty references could initialize Persian even for an international flight. Use the controlled Gregorian calendar prop for this field, retaining ISO values and the other calendar pickers.

Bounded PC-C repair; no active overlapping writer found for this picker. Existing full component regression verifies the Gregorian date and unchanged ISO date. Targeted tests, lint, Web typecheck/build and exact-head hosted gates precede the user-authorized develop merge. No deployment.
