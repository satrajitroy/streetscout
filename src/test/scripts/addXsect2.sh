#!/bin/bash

curl --location 'http://localhost:8080/api/streetscout/xsection/submit' \
--header 'Content-Type: application/json' \
--data '{
    "type": "Intersection",
    "id": "",
    "streetId": "fcc71757f044cba27d0dd0ff128e581af3f98b9320f68627742340dfa4248fe4",
    "intersectionType": "SurfaceStreet",
    "crossStreet": "Acton Road",
    "latitude": 42.596055,
    "longitude": 71.398333,
    "altitude": 200.0
}'