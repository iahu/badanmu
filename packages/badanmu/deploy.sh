export PATH=$PATH:/cygdrive/c/Users/bin/AppData/Roaming/npm:$PWD/node_modules/.bin

for (( i = 8000; i < 8003; i++ )); do
  pm2 startOrRestart ecosystem.config.js --only "badanmu-$i";
  sleep 2
  echo '\n'
done
