#!/bin/bash

cd "$(dirname "$0")/src/test/scripts"
scripts=(
  "addStreet1.sh"
  "addStreet2.sh"
  "addStreet3.sh"
  "addSign1.sh"
  "addSign2.sh"
  "addXsect1.sh"
  "addXsect2.sh"
  "editStreet1.sh"
  #"editSign1.sh"
  #"editXsect1.sh"
)

for script in "${scripts[@]}"; do
  if [ -x "$script" ]; then
    ./"$script"
    if [ $? -ne 0 ]; then
      echo "Test $script failed"
      exit 1
    fi
  fi
done
