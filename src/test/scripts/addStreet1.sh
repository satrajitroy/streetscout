#!/bin/bash

curl --location 'http://localhost:8082/api/streetscout/street/submit' \
--header 'Content-Type: application/json' \
--data '{
    "type": "Street",
    "id": "",
    "zip": "01824",
    "name": "High St",
    "surface": "Asphalt",
    "condition": "Smooth",
    "lanes": 2,
    "width": "Regular"
}'