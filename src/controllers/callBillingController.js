const { Wallet, WalletTransaction, Call, CallRates } = require('../models');

// Helper: fetch base rate per minute for callType
async function getRatePerMinute(callType) {
  const rateRow = await CallRates.findOne({ where: { type: callType } });
  if (!rateRow) {
    // Defaults if not configured
    return callType === 'audio' ? 20 : 25;
  }
  return rateRow.rate;
}

// POST /calls/:id/settle
exports.settleCall = async (req, res) => {
  try {
    const userId = req.user.id; // caller must be authenticated
    const callId = parseInt(req.params.id, 10);
    const { callType, actualDurationSeconds } = req.body;

    if (!callId || !callType) {
      return res.status(400).json({ error: 'Missing callId or callType' });
    }

    const call = await Call.findByPk(callId);
    if (!call) return res.status(404).json({ error: 'Call not found' });

    // Only caller pays
    if (call.fromUserId !== userId) {
      return res.status(403).json({ error: 'Only caller can settle billing' });
    }

    // Compute actual duration from DB timestamps if present, fallback to client-provided
    let durationSeconds = 0;
    if (call.startedAt) {
      const end = call.endedAt ? new Date(call.endedAt) : new Date();
      durationSeconds = Math.max(0, Math.floor((end - new Date(call.startedAt)) / 1000));
    } else if (typeof actualDurationSeconds === 'number') {
      durationSeconds = Math.max(0, Math.floor(actualDurationSeconds));
    }

    // Get rate per minute
    const ratePerMinute = await getRatePerMinute(callType);

    // Compute charge = (seconds/60) * rate, then round to nearest integer coin
    const chargeFloat = (durationSeconds / 60) * Number(ratePerMinute);
    const charge = Math.max(0, Math.round(chargeFloat));

    // Deduct from wallet
    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) return res.status(400).json({ error: 'Wallet not found' });

    const currentBalance = parseFloat(wallet.balance);
    let newBalance = Math.max(0, Math.round(currentBalance - charge)); // keep integer balance

    // Persist deduction and transaction
    await wallet.update({ balance: newBalance });
    await WalletTransaction.create({
      userId,
      type: 'call_spend',
      amount: -charge,
      balanceAfter: newBalance,
      description: `${callType} call (${(durationSeconds / 60).toFixed(2)} min @ ${ratePerMinute}/min)`,
      refId: call.id,
      refType: 'Call',
    });

    return res.json({
      success: true,
      chargedCoins: Number(charge),
      durationSeconds,
      ratePerMinute: Number(ratePerMinute),
      newBalance: Number(newBalance),
    });
  } catch (err) {
    console.error('settleCall error:', err);
    return res.status(500).json({ error: 'Failed to settle call' });
  }
};