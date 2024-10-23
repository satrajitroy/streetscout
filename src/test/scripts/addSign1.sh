#!/bin/bash

curl --location 'http://localhost:8080/api/streetscout/sign/submit' \
--header 'Content-Type: application/json' \
--data '{
    "type": "Sign",
    "id": "",
    "streetId": "fcc71757f044cba27d0dd0ff128e581af3f98b9320f68627742340dfa4248fe4",
    "signType": "Stop",
    "text": "Stop",
    "latitude": 42.576055,
    "longitude": 71.378333,
    "altitude": 160.0
}'