#!/bin/bash

curl --location --request PUT 'http://localhost:8080/api/streetscout/xsection/edit/712a274b-8bc1-4ab4-9df0-81a832d31c4e' \
--header 'Content-Type: application/json' \
--data '{
    "type": "Intersection",
    "id": "",
    "streetId": "fcc71757f044cba27d0dd0ff128e581af3f98b9320f68627742340dfa4248fe4",
    "intersectionType": "FreewayExit",
    "crossStreet": "To Rt 3 S"
}'