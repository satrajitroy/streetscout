#!/bin/bash

curl --location --request PUT 'http://localhost:8082/api/streetscout/street/edit/fcc71757f044cba27d0dd0ff128e581af3f98b9320f68627742340dfa4248fe4' \
--header 'Content-Type: application/json' \
--data '{
    "type": "Street",
    "id":"",
    "zip": "01824",
    "name": "High St",
    "surface": "Concrete",
    "lanes": 4,
    "width": "Wide"
}'