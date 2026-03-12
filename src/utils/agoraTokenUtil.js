const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

const APP_ID = '4740eda900b546d3830523d08f5f1dbe';
const APP_CERTIFICATE = 'f90e53e5405842669863ce6b7119fe3c'; 

function generateToken(channelName, uid, role = 'publisher') {
  const expirationTimeInSeconds = 60 * 60; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
    privilegeExpiredTs
  );

  return token;
}

module.exports = generateToken;
