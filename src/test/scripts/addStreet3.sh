#!/bin/bash

curl --location 'http://localhost:8080/api/streetscout/street/submit' \
--header 'Content-Type: application/json' \
--data '{
    "type": "Street",
    "id": "",
    "zip": "01824",
    "name": "Bartlett St",
    "surface": "Asphalt",
    "condition": "Smooth",
    "lanes": 2,
    "width": "Narrow"
}'