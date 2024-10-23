#!/bin/bash

curl --location 'http://localhost:8080/api/streetscout/sign/submit' \
--header 'Content-Type: application/json' \
--data '{
    "type": "Sign",
    "id": "",
    "streetId": "fcc71757f044cba27d0dd0ff128e581af3f98b9320f68627742340dfa4248fe4",
    "signType": "Direction",
    "text": "To 3 South",
    "latitude": 42.676055,
    "longitude": 71.478333,
    "altitude": 100.0
}'