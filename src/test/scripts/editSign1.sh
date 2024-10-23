#!/bin/bash

curl --location --request PUT 'http://localhost:8080/api/streetscout/sign/edit/5434ec1a-0a3c-47a7-8693-7430f793c613' \
--header 'Content-Type: application/json' \
--data '{
    "type": "Sign",
    "id": "",
    "streetId": "fcc71757f044cba27d0dd0ff128e581af3f98b9320f68627742340dfa4248fe4",
    "signType": "SpeedLimit",
    "text": "25",
    "latitude": 42.576055,
    "longitude": 71.378333,
    "altitude": 160.0
}'