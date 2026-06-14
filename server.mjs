import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

let xrpl = null;
try {
  xrpl = await import('xrpl');
} catch {
  xrpl = null;
}

let keypairs = null;
try {
  keypairs = await import('ripple-keypairs');
} catch {
  keypairs = null;
}

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const WALLETS_PATH = path.join(DATA_DIR, 'wallets.json');
const AUTH_CHALLENGES_PATH = path.join(DATA_DIR, 'auth_challenges.json');
const AUTH_SESSIONS_PATH = path.join(DATA_DIR, 'auth_sessions.json');
const PORT = Number(process.env.PORT || 4100);
const XRPL_SERVER = process.env.XRPL_SERVER || 'wss://s.devnet.rippletest.net:51233';
const EXPLORER_BASE = XRPL_SERVER.includes('devnet')
  ? 'https://devnet.xrpl.org/transactions'
  : 'https://testnet.xrpl.org/transactions';
const LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const LOGIN_SESSION_TTL_MS = 60 * 60 * 1000;
const SCORE_DIMENSIONS = ['food', 'service', 'hygiene', 'consistency', 'value'];
const CANDIDATE_WALLET_KEYS = ['candidateOne', 'candidateTwo', 'candidateThree'];
const MERCHANT_WALLETS = [
  { key: 'merchantPasta', label: 'Merchant Wallet 01', restaurantId: 'rest-sk-pasta' },
  { key: 'merchantVegan', label: 'Merchant Wallet 02', restaurantId: 'rest-queens-vegan' }
];
const MIN_BOUNTY_REWARD_XRP = 2;
const BOUNTY_TOKEN_CURRENCY = 'TBT';
const BOUNTY_TOKEN_LIMIT = '1000000';
const BOUNTY_TOKEN_MERCHANT_FLOAT = '5000';
const BOUNTY_ESCROW_FINISH_DELAY_SECONDS = 10;
const BOUNTY_ESCROW_CANCEL_AFTER_DAYS = 30;

function now() {
  return new Date().toISOString();
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function id(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedDb() {
  const createdAt = now();
  return {
    restaurants: [
      {
        id: 'rest-sk-pasta',
        name: 'Demo Pasta House',
        address: '1 Demo Street, London',
        city: 'London',
        lat: 51.49949,
        lng: -0.17491,
        category: 'Italian',
        priceLevel: 3,
        verifiedStatus: 'verified',
        merchantXrplAccount: null,
        merchantWalletKey: 'merchantPasta',
        averageRating: 0,
        validReviewCount: 0,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'rest-queens-vegan',
        name: 'Demo Vegan Kitchen',
        address: '2 Demo Street, London',
        city: 'London',
        lat: 51.49892,
        lng: -0.17617,
        category: 'Vegan',
        priceLevel: 2,
        verifiedStatus: 'verified',
        merchantXrplAccount: null,
        merchantWalletKey: 'merchantVegan',
        averageRating: 0,
        validReviewCount: 0,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'rest-exhibition-noodle',
        name: 'Demo Noodle Bar',
        address: '3 Demo Street, London',
        city: 'London',
        lat: 51.50064,
        lng: -0.17441,
        category: 'Asian',
        priceLevel: 2,
        verifiedStatus: 'non_verified',
        merchantXrplAccount: null,
        averageRating: 0,
        validReviewCount: 0,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'rest-hyde-sushi',
        name: 'Demo Sushi Counter',
        address: '4 Demo Street, London',
        city: 'London',
        lat: 51.50178,
        lng: -0.17504,
        category: 'Japanese',
        priceLevel: 3,
        verifiedStatus: 'non_verified',
        merchantXrplAccount: null,
        averageRating: 0,
        validReviewCount: 0,
        createdAt,
        updatedAt: createdAt
      }
    ],
    experts: [
      {
        id: 'expert-anna',
        displayName: 'Anonymous Expert 01',
        xrplAddress: null,
        realIdentityStatus: 'in_person_verified',
        credentialType: null,
        credentialStatus: 'not_issued',
        credentialTxHash: null,
        credentialAcceptTxHash: null,
        credentialMode: null,
        level: 1,
        dailyReviewLimit: 2,
        defaultRewardXrp: 2,
        reviewCount: 0,
        publishedReviewCount: 0,
        excludedReviewCount: 0,
        todayReviewCount: 0,
        status: 'active',
        walletKey: 'expertAnna',
        createdAt
      },
      {
        id: 'expert-ben',
        displayName: 'Anonymous Expert 02',
        xrplAddress: null,
        realIdentityStatus: 'in_person_verified',
        credentialType: null,
        credentialStatus: 'not_issued',
        credentialTxHash: null,
        credentialAcceptTxHash: null,
        credentialMode: null,
        level: 1,
        dailyReviewLimit: 2,
        defaultRewardXrp: 2,
        reviewCount: 0,
        publishedReviewCount: 0,
        excludedReviewCount: 0,
        todayReviewCount: 0,
        status: 'active',
        walletKey: 'expertBen',
        createdAt
      },
      {
        id: 'expert-mina',
        displayName: 'Anonymous Expert 03',
        xrplAddress: null,
        realIdentityStatus: 'in_person_verified',
        credentialType: null,
        credentialStatus: 'not_issued',
        credentialTxHash: null,
        credentialAcceptTxHash: null,
        credentialMode: null,
        level: 1,
        dailyReviewLimit: 2,
        defaultRewardXrp: 2,
        reviewCount: 0,
        publishedReviewCount: 0,
        excludedReviewCount: 0,
        todayReviewCount: 0,
        status: 'suspended',
        walletKey: 'expertMina',
        createdAt
      }
    ],
    reviews: [],
    gpsEvidence: [],
    rewardTransactions: [],
    merchantChallenges: [],
    bounties: [],
    auditLogs: [],
    xrplTransactions: []
  };
}

function migrateDb(db) {
  let changed = false;
  if (!Array.isArray(db.bounties)) {
    db.bounties = [];
    changed = true;
  }
  for (const merchant of MERCHANT_WALLETS) {
    const restaurant = db.restaurants?.find((item) => item.id === merchant.restaurantId);
    if (restaurant && restaurant.merchantWalletKey !== merchant.key) {
      restaurant.merchantWalletKey = merchant.key;
      changed = true;
    }
  }
  return changed;
}

function loadDb() {
  ensureDataDir();
  const existing = readJson(DB_PATH, null);
  if (existing) {
    if (migrateDb(existing)) writeJson(DB_PATH, existing);
    return existing;
  }
  const seeded = seedDb();
  writeJson(DB_PATH, seeded);
  return seeded;
}

function loadWallets() {
  ensureDataDir();
  return readJson(WALLETS_PATH, {});
}

function saveWallets(wallets) {
  writeJson(WALLETS_PATH, wallets);
}

function loadAuthChallenges() {
  ensureDataDir();
  return readJson(AUTH_CHALLENGES_PATH, []);
}

function saveAuthChallenges(challenges) {
  writeJson(AUTH_CHALLENGES_PATH, challenges.slice(-80));
}

function loadAuthSessions() {
  ensureDataDir();
  return readJson(AUTH_SESSIONS_PATH, []);
}

function saveAuthSessions(sessions) {
  writeJson(AUTH_SESSIONS_PATH, sessions.slice(-80));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function toHex(value) {
  return Buffer.from(value, 'utf8').toString('hex').toUpperCase();
}

function requireKeypairs() {
  if (!keypairs) throw new Error('The ripple-keypairs package is not available. Run npm install first.');
}

function publicExpert(expert) {
  return {
    id: expert.id,
    displayName: expert.displayName,
    xrplAddress: expert.xrplAddress,
    credentialType: expert.credentialType,
    credentialStatus: expert.credentialStatus,
    credentialMode: expert.credentialMode,
    status: expert.status,
    level: expert.level,
    dailyReviewLimit: expert.dailyReviewLimit,
    defaultRewardXrp: expert.defaultRewardXrp
  };
}

function loginChallengePayload(challenge) {
  return canonicalJson({
    app: 'TrustBite',
    purpose: 'expert_login',
    network: XRPL_SERVER,
    challengeId: challenge.id,
    expertId: challenge.expertId,
    xrplAddress: challenge.xrplAddress,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt
  });
}

function loginChallengeText(challenge) {
  return [
    'TrustBite expert login challenge',
    `Expert: ${challenge.expertId}`,
    `XRPL address: ${challenge.xrplAddress}`,
    `Nonce: ${challenge.nonce}`,
    `Issued at: ${challenge.issuedAt}`,
    `Expires at: ${challenge.expiresAt}`
  ].join('\n');
}

function pruneAuthRecords() {
  const nowMs = Date.now();
  const challenges = loadAuthChallenges().filter((challenge) => (
    challenge.status !== 'used' && new Date(challenge.expiresAt).getTime() > nowMs
  ));
  const sessions = loadAuthSessions().filter((session) => (
    session.status === 'active' && new Date(session.expiresAt).getTime() > nowMs
  ));
  saveAuthChallenges(challenges);
  saveAuthSessions(sessions);
  return { challenges, sessions };
}

function findUsableChallenge(challengeId, expertId) {
  const { challenges } = pruneAuthRecords();
  const challenge = challenges.find((item) => item.id === challengeId && item.expertId === expertId);
  if (!challenge) throw new Error('Login challenge is missing, expired, or already used.');
  if (challenge.status !== 'issued') throw new Error('Login challenge is no longer usable.');
  return { challenge, challenges };
}

function requireExpertLoginSession(expertId, sessionToken) {
  if (!sessionToken) throw new Error('Expert login session is required. Please sign in first.');
  const { sessions } = pruneAuthRecords();
  const session = sessions.find((item) => item.sessionToken === sessionToken && item.expertId === expertId);
  if (!session) throw new Error('Expert login session is invalid or expired. Please sign in again.');
  return session;
}

function requireAdminLoginSession(sessionToken) {
  if (!sessionToken) throw new Error('Admin login session is required. Please sign in first.');
  const { sessions } = pruneAuthRecords();
  const session = sessions.find((item) => item.sessionToken === sessionToken && item.role === 'admin');
  if (!session) throw new Error('Admin login session is invalid or expired. Please sign in again.');
  return session;
}

function requireMerchantLoginSession(sessionToken, restaurantId = null) {
  if (!sessionToken) throw new Error('Merchant login session is required. Please sign in first.');
  const { sessions } = pruneAuthRecords();
  const session = sessions.find((item) => item.sessionToken === sessionToken && item.role === 'merchant');
  if (!session) throw new Error('Merchant login session is invalid or expired. Please sign in again.');
  if (restaurantId && !session.restaurantIds?.includes(restaurantId)) throw new Error('This merchant wallet does not control the selected restaurant.');
  return session;
}

function requireAdminForWalletOperation(body) {
  const wallets = loadWallets();
  if (!wallets.adminOperational?.seed) return;
  requireAdminLoginSession(body.adminSessionToken);
}

function distanceMeters(a, b) {
  const radius = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function addAudit(db, entry) {
  db.auditLogs.push({ id: id('audit'), createdAt: now(), ...entry });
}

function recalculateAllRatings(db) {
  for (const restaurant of db.restaurants) {
    const published = db.reviews.filter((review) => review.restaurantId === restaurant.id && review.status === 'published');
    restaurant.validReviewCount = published.length;
    restaurant.averageRating = published.length
      ? Number((published.reduce((sum, review) => sum + Number(review.rating), 0) / published.length).toFixed(1))
      : 0;
    restaurant.updatedAt = now();
  }
}

function refreshExpertCounters(db) {
  const today = todayKey();
  for (const expert of db.experts) {
    const reviews = db.reviews.filter((review) => review.expertId === expert.id);
    expert.reviewCount = reviews.length;
    expert.publishedReviewCount = reviews.filter((review) => review.status === 'published').length;
    expert.excludedReviewCount = reviews.filter((review) => review.status === 'excluded').length;
    expert.todayReviewCount = reviews.filter((review) => review.submittedAt?.slice(0, 10) === today).length;
  }
}

function isPendingReviewStatus(status) {
  return status === 'pending_review' || status === 'challenge_window';
}

function isReviewChallengeWindowOpen(review) {
  if (!isPendingReviewStatus(review.status)) return false;
  if (!review.challengeWindowEndsAt) return true;
  return new Date(review.challengeWindowEndsAt).getTime() > Date.now();
}

function normalizeDimensionScores(body) {
  const source = body.dimensionScores || {};
  const fallbackRating = Number(body.rating);
  const scores = {};
  for (const key of SCORE_DIMENSIONS) {
    const raw = source[key] ?? (Number.isFinite(fallbackRating) ? fallbackRating : undefined);
    const score = Number(raw);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error(`Dimension score "${key}" must be an integer from 1 to 5.`);
    }
    scores[key] = score;
  }
  return scores;
}

function overallFromDimensionScores(scores) {
  return Number((SCORE_DIMENSIONS.reduce((sum, key) => sum + Number(scores[key]), 0) / SCORE_DIMENSIONS.length).toFixed(1));
}

function normalizeVisitContext(input = {}) {
  const visitType = String(input.visitType || 'other').trim().toLowerCase();
  const allowedVisitTypes = new Set(['lunch', 'dinner', 'brunch', 'takeaway', 'coffee', 'other']);
  if (!allowedVisitTypes.has(visitType)) throw new Error('Visit type is invalid.');
  const partySize = Number(input.partySize);
  const spendPerPersonGbp = Number(input.spendPerPersonGbp);
  const waitTimeMinutes = Number(input.waitTimeMinutes);
  const orderedItems = String(input.orderedItems || '').trim();
  const revisitIntent = String(input.revisitIntent || 'neutral').trim().toLowerCase();
  const allowedRevisit = new Set(['likely', 'neutral', 'unlikely']);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) throw new Error('Party size must be between 1 and 20.');
  if (!Number.isFinite(spendPerPersonGbp) || spendPerPersonGbp < 0 || spendPerPersonGbp > 500) throw new Error('Spend per person must be between 0 and 500 GBP.');
  if (!Number.isInteger(waitTimeMinutes) || waitTimeMinutes < 0 || waitTimeMinutes > 240) throw new Error('Wait time must be between 0 and 240 minutes.');
  if (!orderedItems) throw new Error('Dishes sampled are required.');
  if (!allowedRevisit.has(revisitIntent)) throw new Error('Revisit intent is invalid.');
  return {
    visitType,
    partySize,
    spendPerPersonGbp,
    waitTimeMinutes,
    orderedItems,
    revisitIntent
  };
}

function normalizeOperationalTags(tags) {
  const allowed = new Set(['clean_dining_room', 'accurate_menu', 'slow_service', 'price_mismatch', 'allergen_confidence', 'queue_issue']);
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag)).filter((tag) => allowed.has(tag)))];
}

function saveDb(db) {
  recalculateAllRatings(db);
  refreshExpertCounters(db);
  writeJson(DB_PATH, db);
}

function requireXrpl() {
  if (!xrpl) throw new Error('The xrpl package is not installed yet. Run npm install first.');
}

async function withClient(fn) {
  requireXrpl();
  const client = new xrpl.Client(XRPL_SERVER);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}

function walletFromStored(stored) {
  if (!stored?.seed) return null;
  return xrpl.Wallet.fromSeed(stored.seed);
}

function memoFor(data) {
  return [{
    Memo: {
      MemoType: xrpl.convertStringToHex(data.type || 'xrpl_review_demo'),
      MemoData: xrpl.convertStringToHex(JSON.stringify(data))
    }
  }];
}

async function submitAndWaitResult(client, wallet, tx) {
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  const code = result.result.meta?.TransactionResult;
  if (code !== 'tesSUCCESS') throw new Error(`XRPL transaction failed: ${code}`);
  return result.result;
}

async function submitAndWait(client, wallet, tx) {
  const result = await submitAndWaitResult(client, wallet, tx);
  return result.hash;
}

async function submitMemoPayment({ fromWallet, toAddress, memo, drops = '1' }) {
  return withClient((client) => submitAndWait(client, fromWallet, {
    TransactionType: 'Payment',
    Account: fromWallet.classicAddress,
    Destination: toAddress,
    Amount: drops,
    Memos: memoFor(memo)
  }));
}

async function getBalance(client, address) {
  try {
    const response = await client.request({ command: 'account_info', account: address, ledger_index: 'validated' });
    return Number(xrpl.dropsToXrp(response.result.account_data.Balance)).toFixed(2);
  } catch {
    return null;
  }
}

async function fundWallet(client, label) {
  const funded = await client.fundWallet();
  return {
    label,
    seed: funded.wallet.seed,
    classicAddress: funded.wallet.classicAddress,
    balanceXrp: funded.balance,
    createdAt: now()
  };
}

function tokenValue(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return '0';
  return normalized.toFixed(6).replace(/\.?0+$/, '');
}

function rippleTimeAfterSeconds(seconds) {
  return xrpl.isoTimeToRippleTime(new Date(Date.now() + seconds * 1000).toISOString());
}

function rippleTimeAfterDays(days) {
  return rippleTimeAfterSeconds(days * 24 * 60 * 60);
}

function ensureBountyTokenSetup(wallets) {
  if (!wallets.bountyTokenSetup) {
    wallets.bountyTokenSetup = {
      currency: BOUNTY_TOKEN_CURRENCY,
      issuerAddress: null,
      allowTrustLineLockingTxHash: null,
      trustlineTxHashes: {},
      distributionTxHashes: {},
      ready: false,
      updatedAt: null
    };
  }
  if (!wallets.bountyTokenSetup.trustlineTxHashes) wallets.bountyTokenSetup.trustlineTxHashes = {};
  if (!wallets.bountyTokenSetup.distributionTxHashes) wallets.bountyTokenSetup.distributionTxHashes = {};
  return wallets.bountyTokenSetup;
}

async function getTrustLineBalance(client, address, issuer, currency) {
  try {
    const response = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated',
      peer: issuer
    });
    const line = response.result.lines.find((item) => item.account === issuer && item.currency === currency);
    return line ? Number(line.balance).toFixed(2) : null;
  } catch {
    return null;
  }
}

async function refreshBountyTokenBalances(client, wallets) {
  const issuer = wallets.bountyTokenIssuer?.classicAddress;
  if (!issuer) return;
  for (const key of ['merchantPasta', 'merchantVegan', 'merchantBountyPool']) {
    if (wallets[key]?.classicAddress) {
      wallets[key].balanceTbt = await getTrustLineBalance(client, wallets[key].classicAddress, issuer, BOUNTY_TOKEN_CURRENCY);
    }
  }
}

async function setupBountyTokenInfrastructure(client, wallets) {
  const setup = ensureBountyTokenSetup(wallets);
  const issuerWallet = walletFromStored(wallets.bountyTokenIssuer);
  if (!issuerWallet) throw new Error('Bounty token issuer wallet is missing. Run bootstrap first.');
  setup.issuerAddress = issuerWallet.classicAddress;

  if (!setup.allowTrustLineLockingTxHash) {
    try {
      const result = await submitAndWaitResult(client, issuerWallet, {
        TransactionType: 'AccountSet',
        Account: issuerWallet.classicAddress,
        SetFlag: xrpl.AccountSetAsfFlags.asfAllowTrustLineLocking
      });
      setup.allowTrustLineLockingTxHash = result.hash;
    } catch (err) {
      if (String(err.message || err).includes('tecNO_ALTER')) {
        setup.allowTrustLineLockingTxHash = 'already_enabled';
      } else {
        throw err;
      }
    }
  }

  const trustlineWalletKeys = ['merchantPasta', 'merchantVegan', 'merchantBountyPool'];
  for (const key of trustlineWalletKeys) {
    const holderWallet = walletFromStored(wallets[key]);
    if (!holderWallet || setup.trustlineTxHashes[key]) continue;
    const result = await submitAndWaitResult(client, holderWallet, {
      TransactionType: 'TrustSet',
      Account: holderWallet.classicAddress,
      LimitAmount: {
        currency: BOUNTY_TOKEN_CURRENCY,
        issuer: issuerWallet.classicAddress,
        value: BOUNTY_TOKEN_LIMIT
      }
    });
    setup.trustlineTxHashes[key] = result.hash;
  }

  for (const key of ['merchantPasta', 'merchantVegan']) {
    const merchantWallet = walletFromStored(wallets[key]);
    if (!merchantWallet || setup.distributionTxHashes[key]) continue;
    const result = await submitAndWaitResult(client, issuerWallet, {
      TransactionType: 'Payment',
      Account: issuerWallet.classicAddress,
      Destination: merchantWallet.classicAddress,
      Amount: {
        currency: BOUNTY_TOKEN_CURRENCY,
        issuer: issuerWallet.classicAddress,
        value: BOUNTY_TOKEN_MERCHANT_FLOAT
      },
      Memos: memoFor({
        type: 'trustbite_bounty_token_distribution',
        currency: BOUNTY_TOKEN_CURRENCY,
        recipientAddressHash: sha256(merchantWallet.classicAddress),
        value: BOUNTY_TOKEN_MERCHANT_FLOAT
      })
    });
    setup.distributionTxHashes[key] = result.hash;
  }

  await refreshBountyTokenBalances(client, wallets);
  setup.ready = true;
  setup.updatedAt = now();
  return setup;
}

async function createTokenBountyEscrow({ merchantWallet, bountyPoolAddress, tokenIssuerAddress, totalXrp, bountyPayload }) {
  const finishAfter = rippleTimeAfterSeconds(BOUNTY_ESCROW_FINISH_DELAY_SECONDS);
  const cancelAfter = rippleTimeAfterDays(BOUNTY_ESCROW_CANCEL_AFTER_DAYS);
  return withClient(async (client) => {
    const result = await submitAndWaitResult(client, merchantWallet, {
      TransactionType: 'EscrowCreate',
      Account: merchantWallet.classicAddress,
      Destination: bountyPoolAddress,
      Amount: {
        currency: BOUNTY_TOKEN_CURRENCY,
        issuer: tokenIssuerAddress,
        value: tokenValue(totalXrp)
      },
      FinishAfter: finishAfter,
      CancelAfter: cancelAfter,
      Memos: memoFor({
        type: 'trustbite_review_bounty_token_escrow',
        tokenEscrow: true,
        fundingCurrency: BOUNTY_TOKEN_CURRENCY,
        ...bountyPayload
      })
    });
    const txJson = result.tx_json || result.tx || {};
    return {
      fundingMethod: 'token_escrow',
      fundingCurrency: BOUNTY_TOKEN_CURRENCY,
      fundingTxHash: result.hash,
      escrowSequence: txJson.Sequence,
      escrowFinishAfter: xrpl.rippleTimeToISOTime(finishAfter),
      escrowCancelAfter: xrpl.rippleTimeToISOTime(cancelAfter)
    };
  });
}

async function createXrpBountyEscrow({ merchantWallet, bountyPoolAddress, totalXrp, bountyPayload }) {
  const finishAfter = rippleTimeAfterSeconds(BOUNTY_ESCROW_FINISH_DELAY_SECONDS);
  const cancelAfter = rippleTimeAfterDays(BOUNTY_ESCROW_CANCEL_AFTER_DAYS);
  return withClient(async (client) => {
    const result = await submitAndWaitResult(client, merchantWallet, {
      TransactionType: 'EscrowCreate',
      Account: merchantWallet.classicAddress,
      Destination: bountyPoolAddress,
      Amount: xrpl.xrpToDrops(String(totalXrp)),
      FinishAfter: finishAfter,
      CancelAfter: cancelAfter,
      Memos: memoFor({
        type: 'trustbite_review_bounty_xrp_escrow_fallback',
        tokenEscrow: false,
        fundingCurrency: 'XRP',
        ...bountyPayload
      })
    });
    const txJson = result.tx_json || result.tx || {};
    return {
      fundingMethod: 'xrp_escrow_fallback',
      fundingCurrency: 'XRP',
      fundingTxHash: result.hash,
      escrowSequence: txJson.Sequence,
      escrowFinishAfter: xrpl.rippleTimeToISOTime(finishAfter),
      escrowCancelAfter: xrpl.rippleTimeToISOTime(cancelAfter)
    };
  });
}

async function finishBountyEscrowOnLedger(wallets, bounty) {
  const adminWallet = walletFromStored(wallets.adminOperational);
  if (!adminWallet) throw new Error('Admin issuer wallet is missing. Run bootstrap first.');
  if (!bounty.escrowSequence) throw new Error('This bounty does not have an escrow sequence.');
  return withClient(async (client) => {
    const result = await submitAndWaitResult(client, adminWallet, {
      TransactionType: 'EscrowFinish',
      Account: adminWallet.classicAddress,
      Owner: bounty.merchantAddress,
      OfferSequence: bounty.escrowSequence
    });
    await refreshBountyTokenBalances(client, wallets);
    return result.hash;
  });
}

function credentialHex() {
  return xrpl.convertStringToHex('restaurant_expert_l1');
}

async function issueCredentialOnLedger(issuerWallet, subjectWallet, expert) {
  return withClient(async (client) => {
    const typeHex = credentialHex();
    const createHash = await submitAndWait(client, issuerWallet, {
      TransactionType: 'CredentialCreate',
      Account: issuerWallet.classicAddress,
      Subject: subjectWallet.classicAddress,
      CredentialType: typeHex,
      URI: xrpl.convertStringToHex(`https://trustbite.local/experts/${expert.id}`)
    });
    const acceptHash = await submitAndWait(client, subjectWallet, {
      TransactionType: 'CredentialAccept',
      Account: subjectWallet.classicAddress,
      Issuer: issuerWallet.classicAddress,
      CredentialType: typeHex
    });
    return { createHash, acceptHash, mode: 'xrpl_credentials' };
  });
}

async function issueCredentialForAddressOnLedger(issuerWallet, subjectAddress, subjectWallet, expertId) {
  return withClient(async (client) => {
    const typeHex = credentialHex();
    const createHash = await submitAndWait(client, issuerWallet, {
      TransactionType: 'CredentialCreate',
      Account: issuerWallet.classicAddress,
      Subject: subjectAddress,
      CredentialType: typeHex,
      URI: xrpl.convertStringToHex(`https://trustbite.local/experts/${expertId || subjectAddress}`)
    });
    let acceptHash = null;
    if (subjectWallet) {
      acceptHash = await submitAndWait(client, subjectWallet, {
        TransactionType: 'CredentialAccept',
        Account: subjectWallet.classicAddress,
        Issuer: issuerWallet.classicAddress,
        CredentialType: typeHex
      });
    }
    return { createHash, acceptHash, mode: subjectWallet ? 'xrpl_credentials' : 'xrpl_credential_offer' };
  });
}

async function issueCredentialFallback(issuerWallet, subjectWallet, expert) {
  const txHash = await submitMemoPayment({
    fromWallet: issuerWallet,
    toAddress: subjectWallet.classicAddress,
    memo: {
      type: 'expert_credential_anchor',
      credentialType: 'restaurant_expert_l1',
      expertId: expert.id,
      subject: subjectWallet.classicAddress,
      issuedAt: now(),
      note: 'Fallback credential anchor used when CredentialCreate is unavailable on the selected network.'
    }
  });
  return { createHash: txHash, acceptHash: null, mode: 'memo_anchor_fallback' };
}

function storedWalletForAddress(wallets, address) {
  return Object.values(wallets).find((wallet) => wallet?.classicAddress === address) || null;
}

function storedWalletEntryForAddress(wallets, address) {
  const entry = Object.entries(wallets).find(([, wallet]) => wallet?.classicAddress === address);
  return entry ? { key: entry[0], wallet: entry[1] } : null;
}

function shortServerAddress(address) {
  if (!address) return 'unknown address';
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

function governanceAnchorDestination(wallets) {
  return wallets.reviewRewardPool?.classicAddress || wallets.merchantBountyPool?.classicAddress || null;
}

async function submitGovernanceAnchor(wallets, issuerWallet, memo) {
  const destination = governanceAnchorDestination(wallets);
  if (!destination) throw new Error('Run bootstrap first so the admin wallet has an anchor destination.');
  return submitMemoPayment({
    fromWallet: issuerWallet,
    toAddress: destination,
    memo: {
      type: 'trustbite_admin_governance_anchor',
      anchoredAt: now(),
      ...memo
    }
  });
}

async function deleteCredentialOnLedger(issuerWallet, subjectAddress) {
  return withClient((client) => submitAndWait(client, issuerWallet, {
    TransactionType: 'CredentialDelete',
    Account: issuerWallet.classicAddress,
    Subject: subjectAddress,
    CredentialType: credentialHex()
  }));
}

function walletList(wallets) {
  const labels = {
    adminOperational: 'Admin / Credential Issuer',
    reviewRewardPool: 'Review Reward Pool',
    merchantBountyPool: 'Merchant Bounty Pool',
    bountyTokenIssuer: 'Bounty Token Issuer',
    merchantPasta: 'Merchant Wallet 01',
    merchantVegan: 'Merchant Wallet 02',
    expertAnna: 'Expert Wallet 01',
    expertBen: 'Expert Wallet 02',
    expertMina: 'Expert Wallet 03',
    candidateOne: 'Not Expert Yet 01',
    candidateTwo: 'Not Expert Yet 02',
    candidateThree: 'Not Expert Yet 03'
  };
  return Object.keys(labels).map((key) => ({
    key,
    label: labels[key],
    address: wallets[key]?.classicAddress || null,
    balanceXrp: wallets[key]?.balanceXrp || null,
    balanceTbt: wallets[key]?.balanceTbt || null
  }));
}

function candidateWalletList(wallets) {
  const labels = ['Not Expert Yet 01', 'Not Expert Yet 02', 'Not Expert Yet 03'];
  return CANDIDATE_WALLET_KEYS.map((key, index) => ({
    key,
    label: labels[index],
    address: wallets[key]?.classicAddress || null,
    balanceXrp: wallets[key]?.balanceXrp || null
  }));
}

function merchantWalletList(wallets, db) {
  return MERCHANT_WALLETS.map((merchant) => {
    const restaurant = db.restaurants.find((item) => item.id === merchant.restaurantId);
    return {
      key: merchant.key,
      label: merchant.label,
      restaurantIds: restaurant ? [restaurant.id] : [],
      restaurantName: restaurant?.name || 'Unassigned restaurant',
      address: wallets[merchant.key]?.classicAddress || null,
      balanceXrp: wallets[merchant.key]?.balanceXrp || null
    };
  });
}

function stateResponse() {
  const db = loadDb();
  const wallets = loadWallets();
  refreshExpertCounters(db);
  recalculateAllRatings(db);
  return {
    xrplInstalled: Boolean(xrpl),
    keypairsInstalled: Boolean(keypairs),
    xrplServer: XRPL_SERVER,
    explorerBase: EXPLORER_BASE,
    restaurants: db.restaurants,
    experts: db.experts,
    reviews: db.reviews,
    gpsEvidence: db.gpsEvidence,
    rewardTransactions: db.rewardTransactions,
    merchantChallenges: db.merchantChallenges,
    bounties: db.bounties,
    auditLogs: db.auditLogs,
    wallets: walletList(wallets),
    candidateWallets: candidateWalletList(wallets),
    merchantWallets: merchantWalletList(wallets, db),
    bountyRules: {
      minRewardPerExpertXrp: MIN_BOUNTY_REWARD_XRP,
      fundingCurrency: BOUNTY_TOKEN_CURRENCY,
      fundingMethod: 'token_escrow',
      escrowHint: 'locked via TokenEscrow'
    },
    bountyTokenSetup: wallets.bountyTokenSetup || null
  };
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/state') {
    return json(res, 200, stateResponse());
  }

  const body = req.method === 'POST' ? await readBody(req) : {};

  if (req.method === 'POST' && pathname === '/api/bootstrap') {
    requireAdminForWalletOperation(body);
    return json(res, 200, await apiBootstrap());
  }

  if (req.method === 'POST' && pathname === '/api/refresh-balances') {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiRefreshBalances());
  }

  if (req.method === 'POST' && pathname === '/api/reset-demo') {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, apiResetDemo());
  }

  if (req.method === 'POST' && pathname === '/api/auth/challenge') return json(res, 200, apiCreateAuthChallenge(body));

  if (req.method === 'POST' && pathname === '/api/auth/demo-sign') return json(res, 200, apiDemoSignAuthChallenge(body));

  if (req.method === 'POST' && pathname === '/api/auth/login') return json(res, 200, apiVerifyAuthLogin(body));

  if (req.method === 'POST' && pathname === '/api/auth/wallet/challenge') return json(res, 200, apiCreateWalletAuthChallenge(body));

  if (req.method === 'POST' && pathname === '/api/auth/wallet/demo-sign') return json(res, 200, apiDemoSignWalletAuthChallenge(body));

  if (req.method === 'POST' && pathname === '/api/auth/wallet/login') return json(res, 200, apiVerifyWalletAuthLogin(body));

  if (req.method === 'POST' && pathname === '/api/auth/merchant/challenge') return json(res, 200, apiCreateMerchantAuthChallenge(body));

  if (req.method === 'POST' && pathname === '/api/auth/merchant/demo-sign') return json(res, 200, apiDemoSignMerchantAuthChallenge(body));

  if (req.method === 'POST' && pathname === '/api/auth/merchant/login') return json(res, 200, apiVerifyMerchantAuthLogin(body));

  if (req.method === 'POST' && pathname === '/api/auth/admin/challenge') return json(res, 200, apiCreateAdminAuthChallenge());

  if (req.method === 'POST' && pathname === '/api/auth/admin/demo-sign') return json(res, 200, apiDemoSignAdminAuthChallenge(body));

  if (req.method === 'POST' && pathname === '/api/auth/admin/login') return json(res, 200, apiVerifyAdminAuthLogin(body));

  if (req.method === 'POST' && pathname === '/api/admin/credentials/issue') {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiIssueCredentialToAddress(body));
  }

  if (req.method === 'POST' && pathname === '/api/merchant/bounties') {
    return json(res, 200, await apiCreateMerchantBounty(body));
  }

  let match = pathname.match(/^\/api\/admin\/experts\/([^/]+)\/issue-credential$/);
  if (req.method === 'POST' && match) {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiIssueCredential(match[1]));
  }

  match = pathname.match(/^\/api\/admin\/experts\/([^/]+)\/toggle-suspension$/);
  if (req.method === 'POST' && match) {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiToggleSuspension(match[1]));
  }

  match = pathname.match(/^\/api\/admin\/experts\/([^/]+)\/remove-credential$/);
  if (req.method === 'POST' && match) {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiRemoveCredential(match[1]));
  }

  if (req.method === 'POST' && pathname === '/api/reviews') return json(res, 200, await apiCreateReview(body));

  match = pathname.match(/^\/api\/merchant\/reviews\/([^/]+)\/challenge$/);
  if (req.method === 'POST' && match) return json(res, 200, apiChallengeReview(match[1], body));

  match = pathname.match(/^\/api\/admin\/bounties\/([^/]+)\/assign-random$/);
  if (req.method === 'POST' && match) {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiAssignBounty(match[1], { mode: 'random' }));
  }

  match = pathname.match(/^\/api\/admin\/bounties\/([^/]+)\/assign$/);
  if (req.method === 'POST' && match) {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiAssignBounty(match[1], { mode: 'manual', expertIds: body.expertIds }));
  }

  match = pathname.match(/^\/api\/admin\/bounties\/([^/]+)\/release-escrow$/);
  if (req.method === 'POST' && match) {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiReleaseBountyEscrow(match[1]));
  }

  match = pathname.match(/^\/api\/admin\/reviews\/([^/]+)\/publish$/);
  if (req.method === 'POST' && match) {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, await apiPublishReview(match[1]));
  }

  match = pathname.match(/^\/api\/admin\/reviews\/([^/]+)\/exclude$/);
  if (req.method === 'POST' && match) {
    requireAdminLoginSession(body.adminSessionToken);
    return json(res, 200, apiExcludeReview(match[1]));
  }

  return json(res, 404, { error: 'API route not found.' });
}

async function apiBootstrap() {
  const db = loadDb();
  const wallets = loadWallets();
  const keys = [
    ['adminOperational', 'Admin / Credential Issuer'],
    ['reviewRewardPool', 'Review Reward Pool'],
    ['merchantBountyPool', 'Merchant Bounty Pool'],
    ['bountyTokenIssuer', 'Bounty Token Issuer'],
    ['merchantPasta', 'Merchant Wallet 01'],
    ['merchantVegan', 'Merchant Wallet 02'],
    ['expertAnna', 'Expert Wallet 01'],
    ['expertBen', 'Expert Wallet 02'],
    ['expertMina', 'Expert Wallet 03'],
    ['candidateOne', 'Not Expert Yet 01'],
    ['candidateTwo', 'Not Expert Yet 02'],
    ['candidateThree', 'Not Expert Yet 03']
  ];
  const funded = [];
  const reused = [];
  await withClient(async (client) => {
    for (const [key, label] of keys) {
      if (wallets[key]?.seed) {
        reused.push(label);
      } else {
        wallets[key] = await fundWallet(client, label);
        funded.push(label);
      }
      wallets[key].balanceXrp = await getBalance(client, wallets[key].classicAddress);
    }
    await setupBountyTokenInfrastructure(client, wallets);
  });
  for (const expert of db.experts) {
    const wallet = wallets[expert.walletKey];
    if (wallet?.classicAddress) expert.xrplAddress = wallet.classicAddress;
  }
  for (const merchant of MERCHANT_WALLETS) {
    const restaurant = db.restaurants.find((item) => item.id === merchant.restaurantId);
    if (restaurant) {
      restaurant.merchantWalletKey = merchant.key;
      restaurant.merchantXrplAccount = wallets[merchant.key]?.classicAddress || restaurant.merchantXrplAccount;
    }
  }
  addAudit(db, {
    entityType: 'system',
    entityId: 'bootstrap',
    action: 'xrpl_wallets_bootstrapped',
    actorType: 'admin',
    reason: `Funded: ${funded.join(', ') || 'none'}; reused: ${reused.join(', ') || 'none'}. Bounty token escrow infrastructure ready.`
  });
  saveWallets(wallets);
  saveDb(db);
  return { message: `Wallet bootstrap complete. Bounty token escrow infrastructure ready. Funded: ${funded.join(', ') || 'none'}. Reused: ${reused.join(', ') || 'none'}.`, state: stateResponse() };
}

async function apiRefreshBalances() {
  const wallets = loadWallets();
  await withClient(async (client) => {
    for (const wallet of Object.values(wallets)) {
      if (wallet.classicAddress) wallet.balanceXrp = await getBalance(client, wallet.classicAddress);
    }
    await refreshBountyTokenBalances(client, wallets);
  });
  saveWallets(wallets);
  return { message: 'Balances refreshed.', state: stateResponse() };
}

function apiResetDemo() {
  const current = loadDb();
  const seeded = seedDb();
  seeded.experts = current.experts;
  seeded.restaurants = seeded.restaurants.map((restaurant) => {
    const existing = current.restaurants.find((item) => item.id === restaurant.id);
    return {
      ...restaurant,
      merchantXrplAccount: existing?.merchantXrplAccount || restaurant.merchantXrplAccount || null,
      merchantWalletKey: existing?.merchantWalletKey || restaurant.merchantWalletKey || null
    };
  });
  addAudit(seeded, {
    entityType: 'system',
    entityId: 'reset',
    action: 'demo_reviews_reset',
    actorType: 'admin',
    reason: 'Cleared reviews, GPS evidence, challenges and reward records. Wallets and credentials kept.'
  });
  saveDb(seeded);
  return { message: 'Demo reset complete. Wallets and expert credentials were kept.' };
}

async function apiIssueCredential(expertId) {
  const db = loadDb();
  const wallets = loadWallets();
  const expert = db.experts.find((item) => item.id === expertId);
  if (!expert) throw new Error('Expert not found.');
  if (!expert.xrplAddress) throw new Error('Run bootstrap before issuing credentials.');
  const issuerWallet = walletFromStored(wallets.adminOperational);
  const subjectWallet = walletFromStored(wallets[expert.walletKey]);
  if (!issuerWallet || !subjectWallet) throw new Error('Required wallets are missing. Run bootstrap first.');

  let result;
  try {
    result = await issueCredentialOnLedger(issuerWallet, subjectWallet, expert);
  } catch (err) {
    result = await issueCredentialFallback(issuerWallet, subjectWallet, expert);
    result.warning = `Real CredentialCreate failed, so memo anchor fallback was used: ${err.message}`;
  }

  expert.credentialType = 'restaurant_expert_l1';
  expert.credentialStatus = 'active';
  expert.credentialTxHash = result.createHash;
  expert.credentialAcceptTxHash = result.acceptHash;
  expert.credentialMode = result.mode;
  addAudit(db, {
    entityType: 'expert',
    entityId: expert.id,
    action: 'credential_issued',
    fromStatus: 'not_issued',
    toStatus: 'active',
    actorType: 'admin',
    reason: `In-person interview completed; credential mode: ${result.mode}.`,
    xrplTxHash: result.createHash
  });
  saveDb(db);
  return { message: `Credential issued to ${shortServerAddress(expert.xrplAddress)} using ${result.mode}.`, ...result };
}

async function apiIssueCredentialToAddress(body) {
  const db = loadDb();
  const wallets = loadWallets();
  const subjectAddress = String(body.subjectAddress || '').trim();
  if (!xrpl?.isValidClassicAddress(subjectAddress)) throw new Error('Enter a valid XRPL classic address.');
  const issuerWallet = walletFromStored(wallets.adminOperational);
  if (!issuerWallet) throw new Error('Admin issuer wallet is missing. Run bootstrap first.');

  let expert = db.experts.find((item) => item.xrplAddress === subjectAddress);
  if (!expert) {
    expert = {
      id: id('expert'),
      displayName: 'Anonymous Expert',
      xrplAddress: subjectAddress,
      realIdentityStatus: 'in_person_verified',
      credentialType: null,
      credentialStatus: 'not_issued',
      credentialTxHash: null,
      credentialAcceptTxHash: null,
      credentialMode: null,
      level: 1,
      dailyReviewLimit: 2,
      defaultRewardXrp: 2,
      reviewCount: 0,
      publishedReviewCount: 0,
      excludedReviewCount: 0,
      todayReviewCount: 0,
      status: 'active',
      walletKey: null,
      createdAt: now()
    };
    db.experts.push(expert);
  }

  const storedSubjectEntry = storedWalletEntryForAddress(wallets, subjectAddress);
  const subjectWallet = walletFromStored(storedSubjectEntry?.wallet);
  let result;
  try {
    result = await issueCredentialForAddressOnLedger(issuerWallet, subjectAddress, subjectWallet, expert.id);
    if (!subjectWallet) {
      result.warning = 'CredentialCreate was submitted. This external address must accept the credential from its own wallet.';
    }
  } catch (err) {
    const anchorHash = await submitGovernanceAnchor(wallets, issuerWallet, {
      action: 'credential_issue_anchor',
      credentialType: 'restaurant_expert_l1',
      expertId: expert.id,
      subject: subjectAddress,
      reason: `CredentialCreate could not be completed on this network state: ${err.message}`
    });
    result = {
      createHash: anchorHash,
      acceptHash: null,
      mode: 'memo_anchor_fallback',
      warning: `CredentialCreate failed, so an on-chain governance anchor was used: ${err.message}`
    };
  }

  const previousStatus = expert.credentialStatus;
  expert.credentialType = 'restaurant_expert_l1';
  expert.credentialStatus = 'active';
  expert.status = expert.status === 'removed' ? 'active' : expert.status;
  expert.walletKey = expert.walletKey || storedSubjectEntry?.key || null;
  expert.credentialTxHash = result.createHash;
  expert.credentialAcceptTxHash = result.acceptHash;
  expert.credentialMode = result.mode;
  addAudit(db, {
    entityType: 'expert',
    entityId: expert.id,
    action: 'credential_issued_to_address',
    fromStatus: previousStatus,
    toStatus: 'active',
    actorType: 'admin',
    reason: `In-person verification completed for ${shortServerAddress(subjectAddress)}; credential mode: ${result.mode}.`,
    xrplTxHash: result.createHash
  });
  saveDb(db);
  return { message: `Credential issued to ${shortServerAddress(subjectAddress)} using ${result.mode}.`, expertId: expert.id, ...result };
}

async function apiToggleSuspension(expertId) {
  const db = loadDb();
  const wallets = loadWallets();
  const expert = db.experts.find((item) => item.id === expertId);
  if (!expert) throw new Error('Expert not found.');
  if (!expert.xrplAddress) throw new Error('Expert wallet address is missing.');
  if (expert.credentialStatus !== 'active') throw new Error('Only an active credential can be suspended or reactivated.');
  const issuerWallet = walletFromStored(wallets.adminOperational);
  if (!issuerWallet) throw new Error('Admin issuer wallet is missing. Run bootstrap first.');

  const oldStatus = expert.status;
  const nextStatus = expert.status === 'active' ? 'suspended' : 'active';
  const governanceTxHash = await submitGovernanceAnchor(wallets, issuerWallet, {
    action: nextStatus === 'suspended' ? 'credential_suspended' : 'credential_reactivated',
    credentialType: expert.credentialType || 'restaurant_expert_l1',
    expertId: expert.id,
    subject: expert.xrplAddress,
    fromStatus: oldStatus,
    toStatus: nextStatus
  });
  expert.status = nextStatus;
  expert.credentialSuspensionTxHash = governanceTxHash;
  addAudit(db, {
    entityType: 'expert',
    entityId: expert.id,
    action: nextStatus === 'suspended' ? 'credential_suspended' : 'credential_reactivated',
    fromStatus: oldStatus,
    toStatus: expert.status,
    actorType: 'admin',
    reason: 'Manual admin credential governance.',
    xrplTxHash: governanceTxHash
  });
  saveDb(db);
  return { message: `Credential ${nextStatus === 'suspended' ? 'suspended' : 'reactivated'} for ${shortServerAddress(expert.xrplAddress)}.`, governanceTxHash };
}

async function apiRemoveCredential(expertId) {
  const db = loadDb();
  const wallets = loadWallets();
  const expert = db.experts.find((item) => item.id === expertId);
  if (!expert) throw new Error('Expert not found.');
  if (!expert.xrplAddress) throw new Error('Expert wallet address is missing.');
  const issuerWallet = walletFromStored(wallets.adminOperational);
  if (!issuerWallet) throw new Error('Admin issuer wallet is missing. Run bootstrap first.');

  let result;
  try {
    const deleteHash = await deleteCredentialOnLedger(issuerWallet, expert.xrplAddress);
    result = { deleteHash, mode: 'xrpl_credential_delete' };
  } catch (err) {
    const governanceTxHash = await submitGovernanceAnchor(wallets, issuerWallet, {
      action: 'credential_removed_anchor',
      credentialType: expert.credentialType || 'restaurant_expert_l1',
      expertId: expert.id,
      subject: expert.xrplAddress,
      reason: `CredentialDelete could not be completed on this network state: ${err.message}`
    });
    result = {
      governanceTxHash,
      mode: 'memo_anchor_fallback',
      warning: `CredentialDelete failed, so an on-chain governance anchor was used: ${err.message}`
    };
  }

  const oldStatus = `${expert.status}:${expert.credentialStatus}`;
  expert.status = 'suspended';
  expert.credentialStatus = 'removed';
  expert.credentialRemovalTxHash = result.deleteHash || result.governanceTxHash;
  expert.credentialMode = result.mode;
  addAudit(db, {
    entityType: 'expert',
    entityId: expert.id,
    action: 'credential_removed',
    fromStatus: oldStatus,
    toStatus: 'suspended:removed',
    actorType: 'admin',
    reason: `Admin removed credential for ${shortServerAddress(expert.xrplAddress)}.`,
    xrplTxHash: result.deleteHash || result.governanceTxHash
  });
  saveDb(db);
  return { message: `Credential removed for ${shortServerAddress(expert.xrplAddress)}.`, ...result };
}

function apiCreateAuthChallenge(body) {
  requireKeypairs();
  const db = loadDb();
  const expert = db.experts.find((item) => item.id === body.expertId);
  if (!expert) throw new Error('Expert not found.');
  if (!expert.xrplAddress) throw new Error('This expert does not have an XRPL wallet yet. Ask Admin to create/fund wallets first.');
  if (expert.status !== 'active') throw new Error('This expert is not active.');
  if (expert.credentialStatus !== 'active') throw new Error('This expert credential is not active.');

  const issuedAt = now();
  const challenge = {
    id: id('login'),
    expertId: expert.id,
    xrplAddress: expert.xrplAddress,
    nonce: crypto.randomBytes(16).toString('hex'),
    status: 'issued',
    issuedAt,
    expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS).toISOString()
  };
  const { challenges } = pruneAuthRecords();
  challenges.push(challenge);
  saveAuthChallenges(challenges);
  return {
    message: 'Login challenge created.',
    challengeId: challenge.id,
    challengeText: loginChallengeText(challenge),
    challengePayload: loginChallengePayload(challenge),
    expiresAt: challenge.expiresAt,
    expert: publicExpert(expert)
  };
}

function apiDemoSignAuthChallenge(body) {
  requireKeypairs();
  const db = loadDb();
  const wallets = loadWallets();
  const expert = db.experts.find((item) => item.id === body.expertId);
  if (!expert) throw new Error('Expert not found.');
  const { challenge } = findUsableChallenge(body.challengeId, expert.id);
  const wallet = walletFromStored(wallets[expert.walletKey]);
  if (!wallet) throw new Error('This expert wallet is missing. Ask Admin to bootstrap wallets first.');
  if (wallet.classicAddress !== challenge.xrplAddress) throw new Error('Stored wallet does not match the challenge address.');

  const challengePayload = loginChallengePayload(challenge);
  const signature = keypairs.sign(toHex(challengePayload), wallet.privateKey);
  return {
    message: 'Challenge signed by the demo expert wallet.',
    challengeId: challenge.id,
    signature,
    signingPublicKey: wallet.publicKey,
    signerAddress: wallet.classicAddress,
    signatureHash: sha256(signature)
  };
}

function apiVerifyAuthLogin(body) {
  requireKeypairs();
  const db = loadDb();
  const expert = db.experts.find((item) => item.id === body.expertId);
  if (!expert) throw new Error('Expert not found.');
  if (expert.status !== 'active') throw new Error('This expert is not active.');
  if (expert.credentialStatus !== 'active') throw new Error('This expert credential is not active.');

  const { challenge, challenges } = findUsableChallenge(body.challengeId, expert.id);
  const signature = String(body.signature || '');
  const signingPublicKey = String(body.signingPublicKey || '');
  if (!signature || !signingPublicKey) throw new Error('Signature and signing public key are required.');

  const challengePayload = loginChallengePayload(challenge);
  const signatureValid = keypairs.verify(toHex(challengePayload), signature, signingPublicKey);
  const signerAddress = keypairs.deriveAddress(signingPublicKey);
  if (!signatureValid) throw new Error('Signature verification failed.');
  if (signerAddress !== expert.xrplAddress || signerAddress !== challenge.xrplAddress) {
    throw new Error('Signature belongs to a different XRPL address.');
  }

  challenge.status = 'used';
  challenge.verifiedAt = now();
  saveAuthChallenges(challenges);

  const session = {
    sessionId: id('session'),
    sessionToken: crypto.randomBytes(24).toString('hex'),
    expertId: expert.id,
    xrplAddress: expert.xrplAddress,
    challengeId: challenge.id,
    signerAddress,
    signatureHash: sha256(signature),
    status: 'active',
    verifiedAt: now(),
    expiresAt: new Date(Date.now() + LOGIN_SESSION_TTL_MS).toISOString()
  };
  const { sessions } = pruneAuthRecords();
  sessions.push(session);
  saveAuthSessions(sessions);

  addAudit(db, {
    entityType: 'expert',
    entityId: expert.id,
    action: 'expert_login_verified',
    actorType: 'expert',
    reason: 'XRPL wallet signature matched the credentialed expert address.',
    xrplTxHash: null
  });
  saveDb(db);

  return {
    message: 'Expert wallet verified. Login complete.',
    session,
    expert: publicExpert(expert),
    verification: {
      challengeId: challenge.id,
      signatureValid,
      signerAddress,
      addressMatchesCredential: true,
      challengePayloadHash: sha256(challengePayload)
    }
  };
}

function candidateChallengeSubject(walletKey) {
  return `candidate:${walletKey}`;
}

function requireCandidateWallet(wallets, walletKey) {
  if (!CANDIDATE_WALLET_KEYS.includes(walletKey)) throw new Error('Unknown candidate wallet.');
  const stored = wallets[walletKey];
  if (!stored?.classicAddress || !stored?.seed) throw new Error('Candidate wallet is missing. Ask Admin to create/fund Devnet wallets first.');
  return stored;
}

function apiCreateWalletAuthChallenge(body) {
  requireKeypairs();
  const wallets = loadWallets();
  const walletKey = String(body.walletKey || '');
  const stored = requireCandidateWallet(wallets, walletKey);
  const issuedAt = now();
  const challenge = {
    id: id('login'),
    role: 'candidate',
    walletKey,
    expertId: candidateChallengeSubject(walletKey),
    xrplAddress: stored.classicAddress,
    nonce: crypto.randomBytes(16).toString('hex'),
    status: 'issued',
    issuedAt,
    expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS).toISOString()
  };
  const { challenges } = pruneAuthRecords();
  challenges.push(challenge);
  saveAuthChallenges(challenges);
  return {
    message: 'Wallet login challenge created.',
    challengeId: challenge.id,
    challengeText: loginChallengeText(challenge),
    challengePayload: loginChallengePayload(challenge),
    expiresAt: challenge.expiresAt,
    wallet: { walletKey, xrplAddress: stored.classicAddress }
  };
}

function apiDemoSignWalletAuthChallenge(body) {
  requireKeypairs();
  const wallets = loadWallets();
  const walletKey = String(body.walletKey || '');
  const stored = requireCandidateWallet(wallets, walletKey);
  const { challenge } = findUsableChallenge(body.challengeId, candidateChallengeSubject(walletKey));
  const wallet = walletFromStored(stored);
  if (wallet.classicAddress !== challenge.xrplAddress) throw new Error('Stored wallet does not match the challenge address.');

  const challengePayload = loginChallengePayload(challenge);
  const signature = keypairs.sign(toHex(challengePayload), wallet.privateKey);
  return {
    message: 'Challenge signed by the demo wallet.',
    challengeId: challenge.id,
    signature,
    signingPublicKey: wallet.publicKey,
    signerAddress: wallet.classicAddress,
    signatureHash: sha256(signature)
  };
}

function apiVerifyWalletAuthLogin(body) {
  requireKeypairs();
  const db = loadDb();
  const wallets = loadWallets();
  const walletKey = String(body.walletKey || '');
  const stored = requireCandidateWallet(wallets, walletKey);
  const { challenge, challenges } = findUsableChallenge(body.challengeId, candidateChallengeSubject(walletKey));
  const signature = String(body.signature || '');
  const signingPublicKey = String(body.signingPublicKey || '');
  if (!signature || !signingPublicKey) throw new Error('Signature and signing public key are required.');

  const challengePayload = loginChallengePayload(challenge);
  const signatureValid = keypairs.verify(toHex(challengePayload), signature, signingPublicKey);
  const signerAddress = keypairs.deriveAddress(signingPublicKey);
  if (!signatureValid) throw new Error('Signature verification failed.');
  if (signerAddress !== stored.classicAddress || signerAddress !== challenge.xrplAddress) {
    throw new Error('Signature belongs to a different XRPL address.');
  }

  challenge.status = 'used';
  challenge.verifiedAt = now();
  saveAuthChallenges(challenges);

  const session = {
    sessionId: id('session'),
    sessionToken: crypto.randomBytes(24).toString('hex'),
    role: 'candidate',
    walletKey,
    xrplAddress: stored.classicAddress,
    challengeId: challenge.id,
    signerAddress,
    signatureHash: sha256(signature),
    status: 'active',
    verifiedAt: now(),
    expiresAt: new Date(Date.now() + LOGIN_SESSION_TTL_MS).toISOString()
  };
  const { sessions } = pruneAuthRecords();
  sessions.push(session);
  saveAuthSessions(sessions);

  addAudit(db, {
    entityType: 'wallet',
    entityId: walletKey,
    action: 'candidate_wallet_login_verified',
    actorType: 'candidate',
    reason: 'XRPL wallet signature matched a not-yet-expert candidate wallet.',
    xrplTxHash: null
  });
  saveDb(db);

  const credentialedExpert = db.experts.find((expert) => expert.xrplAddress === stored.classicAddress && expert.credentialStatus === 'active');
  return {
    message: credentialedExpert ? 'Wallet verified. Credential is now active.' : 'Wallet verified. Not expert yet.',
    session,
    expert: credentialedExpert ? publicExpert(credentialedExpert) : null,
    verification: {
      challengeId: challenge.id,
      signatureValid,
      signerAddress,
      addressMatchesWallet: true,
      challengePayloadHash: sha256(challengePayload)
    }
  };
}

function merchantConfigByKey(walletKey) {
  return MERCHANT_WALLETS.find((item) => item.key === walletKey) || null;
}

function merchantRestaurantIds(db, walletKey) {
  return db.restaurants
    .filter((restaurant) => restaurant.merchantWalletKey === walletKey)
    .map((restaurant) => restaurant.id);
}

function merchantChallengeSubject(walletKey) {
  return `merchant:${walletKey}`;
}

function requireMerchantWallet(wallets, walletKey) {
  const merchant = merchantConfigByKey(walletKey);
  if (!merchant) throw new Error('Unknown merchant wallet.');
  const stored = wallets[walletKey];
  if (!stored?.classicAddress || !stored?.seed) throw new Error('Merchant wallet is missing. Ask Admin to create/fund Devnet wallets first.');
  return { merchant, stored };
}

function apiCreateMerchantAuthChallenge(body) {
  requireKeypairs();
  const wallets = loadWallets();
  const walletKey = String(body.walletKey || '');
  const { merchant, stored } = requireMerchantWallet(wallets, walletKey);
  const issuedAt = now();
  const challenge = {
    id: id('login'),
    role: 'merchant',
    walletKey,
    expertId: merchantChallengeSubject(walletKey),
    xrplAddress: stored.classicAddress,
    nonce: crypto.randomBytes(16).toString('hex'),
    status: 'issued',
    issuedAt,
    expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS).toISOString()
  };
  const { challenges } = pruneAuthRecords();
  challenges.push(challenge);
  saveAuthChallenges(challenges);
  return {
    message: 'Merchant login challenge created.',
    challengeId: challenge.id,
    challengeText: loginChallengeText(challenge),
    challengePayload: loginChallengePayload(challenge),
    expiresAt: challenge.expiresAt,
    merchant: { walletKey, label: merchant.label, xrplAddress: stored.classicAddress }
  };
}

function apiDemoSignMerchantAuthChallenge(body) {
  requireKeypairs();
  const wallets = loadWallets();
  const walletKey = String(body.walletKey || '');
  const { stored } = requireMerchantWallet(wallets, walletKey);
  const { challenge } = findUsableChallenge(body.challengeId, merchantChallengeSubject(walletKey));
  const wallet = walletFromStored(stored);
  if (wallet.classicAddress !== challenge.xrplAddress) throw new Error('Stored merchant wallet does not match the challenge address.');

  const challengePayload = loginChallengePayload(challenge);
  const signature = keypairs.sign(toHex(challengePayload), wallet.privateKey);
  return {
    message: 'Challenge signed by the demo merchant wallet.',
    challengeId: challenge.id,
    signature,
    signingPublicKey: wallet.publicKey,
    signerAddress: wallet.classicAddress,
    signatureHash: sha256(signature)
  };
}

function apiVerifyMerchantAuthLogin(body) {
  requireKeypairs();
  const db = loadDb();
  const wallets = loadWallets();
  const walletKey = String(body.walletKey || '');
  const { merchant, stored } = requireMerchantWallet(wallets, walletKey);
  const { challenge, challenges } = findUsableChallenge(body.challengeId, merchantChallengeSubject(walletKey));
  const signature = String(body.signature || '');
  const signingPublicKey = String(body.signingPublicKey || '');
  if (!signature || !signingPublicKey) throw new Error('Signature and signing public key are required.');

  const challengePayload = loginChallengePayload(challenge);
  const signatureValid = keypairs.verify(toHex(challengePayload), signature, signingPublicKey);
  const signerAddress = keypairs.deriveAddress(signingPublicKey);
  if (!signatureValid) throw new Error('Signature verification failed.');
  if (signerAddress !== stored.classicAddress || signerAddress !== challenge.xrplAddress) {
    throw new Error('Signature belongs to a different XRPL address.');
  }

  challenge.status = 'used';
  challenge.verifiedAt = now();
  saveAuthChallenges(challenges);

  const session = {
    sessionId: id('session'),
    sessionToken: crypto.randomBytes(24).toString('hex'),
    role: 'merchant',
    walletKey,
    label: merchant.label,
    restaurantIds: merchantRestaurantIds(db, walletKey),
    xrplAddress: stored.classicAddress,
    challengeId: challenge.id,
    signerAddress,
    signatureHash: sha256(signature),
    status: 'active',
    verifiedAt: now(),
    expiresAt: new Date(Date.now() + LOGIN_SESSION_TTL_MS).toISOString()
  };
  const { sessions } = pruneAuthRecords();
  sessions.push(session);
  saveAuthSessions(sessions);

  addAudit(db, {
    entityType: 'merchant',
    entityId: walletKey,
    action: 'merchant_login_verified',
    actorType: 'merchant',
    reason: 'XRPL wallet signature matched a verified restaurant merchant wallet.',
    xrplTxHash: null
  });
  saveDb(db);

  return {
    message: 'Merchant wallet verified. Login complete.',
    session,
    verification: {
      challengeId: challenge.id,
      signatureValid,
      signerAddress,
      restaurantIds: session.restaurantIds,
      challengePayloadHash: sha256(challengePayload)
    }
  };
}

function apiCreateAdminAuthChallenge() {
  requireKeypairs();
  const wallets = loadWallets();
  const adminAddress = wallets.adminOperational?.classicAddress;
  if (!adminAddress) throw new Error('Admin wallet is missing. Create/fund Devnet wallets first.');

  const issuedAt = now();
  const challenge = {
    id: id('login'),
    role: 'admin',
    expertId: 'adminOperational',
    xrplAddress: adminAddress,
    nonce: crypto.randomBytes(16).toString('hex'),
    status: 'issued',
    issuedAt,
    expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS).toISOString()
  };
  const { challenges } = pruneAuthRecords();
  challenges.push(challenge);
  saveAuthChallenges(challenges);
  return {
    message: 'Admin login challenge created.',
    challengeId: challenge.id,
    challengeText: loginChallengeText(challenge),
    challengePayload: loginChallengePayload(challenge),
    expiresAt: challenge.expiresAt,
    admin: { xrplAddress: adminAddress }
  };
}

function apiDemoSignAdminAuthChallenge(body) {
  requireKeypairs();
  const wallets = loadWallets();
  const { challenge } = findUsableChallenge(body.challengeId, 'adminOperational');
  const wallet = walletFromStored(wallets.adminOperational);
  if (!wallet) throw new Error('Admin wallet is missing. Create/fund Devnet wallets first.');
  if (wallet.classicAddress !== challenge.xrplAddress) throw new Error('Stored admin wallet does not match the challenge address.');

  const challengePayload = loginChallengePayload(challenge);
  const signature = keypairs.sign(toHex(challengePayload), wallet.privateKey);
  return {
    message: 'Challenge signed by the demo admin wallet.',
    challengeId: challenge.id,
    signature,
    signingPublicKey: wallet.publicKey,
    signerAddress: wallet.classicAddress,
    signatureHash: sha256(signature)
  };
}

function apiVerifyAdminAuthLogin(body) {
  requireKeypairs();
  const wallets = loadWallets();
  const adminAddress = wallets.adminOperational?.classicAddress;
  if (!adminAddress) throw new Error('Admin wallet is missing. Create/fund Devnet wallets first.');
  const { challenge, challenges } = findUsableChallenge(body.challengeId, 'adminOperational');
  const signature = String(body.signature || '');
  const signingPublicKey = String(body.signingPublicKey || '');
  if (!signature || !signingPublicKey) throw new Error('Signature and signing public key are required.');

  const challengePayload = loginChallengePayload(challenge);
  const signatureValid = keypairs.verify(toHex(challengePayload), signature, signingPublicKey);
  const signerAddress = keypairs.deriveAddress(signingPublicKey);
  if (!signatureValid) throw new Error('Signature verification failed.');
  if (signerAddress !== adminAddress || signerAddress !== challenge.xrplAddress) {
    throw new Error('Signature belongs to a different XRPL address.');
  }

  challenge.status = 'used';
  challenge.verifiedAt = now();
  saveAuthChallenges(challenges);

  const session = {
    sessionId: id('session'),
    sessionToken: crypto.randomBytes(24).toString('hex'),
    role: 'admin',
    expertId: 'adminOperational',
    xrplAddress: adminAddress,
    challengeId: challenge.id,
    signerAddress,
    signatureHash: sha256(signature),
    status: 'active',
    verifiedAt: now(),
    expiresAt: new Date(Date.now() + LOGIN_SESSION_TTL_MS).toISOString()
  };
  const { sessions } = pruneAuthRecords();
  sessions.push(session);
  saveAuthSessions(sessions);

  const db = loadDb();
  addAudit(db, {
    entityType: 'admin',
    entityId: 'adminOperational',
    action: 'admin_login_verified',
    actorType: 'admin',
    reason: 'XRPL wallet signature matched the admin issuer address.',
    xrplTxHash: null
  });
  saveDb(db);

  return {
    message: 'Admin wallet verified. Login complete.',
    session,
    verification: {
      challengeId: challenge.id,
      signatureValid,
      signerAddress,
      addressMatchesCredential: true,
      challengePayloadHash: sha256(challengePayload)
    }
  };
}

async function apiCreateReview(body) {
  const db = loadDb();
  const wallets = loadWallets();
  const expert = db.experts.find((item) => item.id === body.expertId);
  const restaurant = db.restaurants.find((item) => item.id === body.restaurantId);
  if (!expert) throw new Error('Expert not found.');
  if (!restaurant) throw new Error('Restaurant not found.');
  if (expert.status !== 'active') throw new Error('Expert is not active.');
  if (expert.credentialStatus !== 'active') throw new Error('Expert credential is not active.');
  if (!expert.xrplAddress) throw new Error('Expert does not have an XRPL address yet.');
  requireExpertLoginSession(expert.id, body.sessionToken);
  const dimensionScores = normalizeDimensionScores(body);
  const rating = overallFromDimensionScores(dimensionScores);
  const visitContext = normalizeVisitContext(body.visitContext);
  const operationalTags = normalizeOperationalTags(body.operationalTags);
  if (!body.title?.trim() || !body.body?.trim()) throw new Error('Title and review text are required.');
  refreshExpertCounters(db);
  if ((expert.todayReviewCount || 0) >= expert.dailyReviewLimit) throw new Error(`Daily limit reached: L1 expert can submit ${expert.dailyReviewLimit} reviews per day.`);
  const duplicate = db.reviews.find((review) => (
    review.expertId === expert.id &&
    review.restaurantId === restaurant.id &&
    review.status !== 'excluded' &&
    Date.now() - new Date(review.submittedAt).getTime() < 30 * 24 * 60 * 60 * 1000
  ));
  if (duplicate) throw new Error('This expert already has a recent active review for this restaurant.');
  const gps = body.gps || {};
  if (typeof gps.lat !== 'number' || typeof gps.lng !== 'number') throw new Error('GPS evidence is required.');
  const accuracyMeters = Number(gps.accuracyMeters || 9999);
  if (accuracyMeters > 100) throw new Error(`GPS accuracy is too low (${Math.round(accuracyMeters)}m). Need 100m or better.`);
  const distance = distanceMeters({ lat: gps.lat, lng: gps.lng }, { lat: restaurant.lat, lng: restaurant.lng });
  if (distance > 100) throw new Error(`GPS is ${Math.round(distance)}m from the restaurant. Need within 100m.`);

  const expertWallet = walletFromStored(wallets[expert.walletKey]);
  const adminWallet = walletFromStored(wallets.adminOperational);
  if (!expertWallet || !adminWallet) throw new Error('Required wallets are missing. Run bootstrap first.');

  const reviewId = id('review');
  const capturedAt = now();
  const gpsEvidence = {
    id: id('gps'),
    reviewId,
    restaurantId: restaurant.id,
    expertId: expert.id,
    lat: Number(gps.lat),
    lng: Number(gps.lng),
    accuracyMeters,
    distanceToRestaurantMeters: Number(distance.toFixed(2)),
    validationStatus: 'within_radius',
    source: gps.source || 'browser',
    capturedAt
  };
  gpsEvidence.gpsEvidenceHash = sha256(gpsEvidence);

  const reviewContent = {
    reviewId,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    expertId: expert.id,
    expertAddress: expert.xrplAddress,
    rating,
    dimensionScores,
    title: body.title.trim(),
    body: body.body.trim(),
    visitContext,
    operationalTags,
    gpsEvidenceHash: gpsEvidence.gpsEvidenceHash,
    submittedAt: capturedAt
  };
  const contentHash = sha256(reviewContent);
  const restaurantIdHash = sha256(restaurant.id);
  const structuredDataHash = sha256({ dimensionScores, visitContext, operationalTags });
  const reviewMemo = {
    type: 'expert_restaurant_review',
    reviewId,
    restaurantIdHash,
    reviewContentHash: contentHash,
    gpsEvidenceHash: gpsEvidence.gpsEvidenceHash,
    rating,
    dimensionScores,
    structuredDataHash,
    expertCredentialType: expert.credentialType,
    status: 'submitted',
    createdAt: capturedAt
  };
  const txHash = await submitMemoPayment({
    fromWallet: expertWallet,
    toAddress: adminWallet.classicAddress,
    memo: reviewMemo
  });

  const review = {
    id: reviewId,
    restaurantId: restaurant.id,
    expertId: expert.id,
    rating,
    dimensionScores,
    title: body.title.trim(),
    body: body.body.trim(),
    visitContext,
    operationalTags,
    gpsEvidenceHash: gpsEvidence.gpsEvidenceHash,
    contentHash,
    structuredDataHash,
    restaurantIdHash,
    xrplReviewTxHash: txHash,
    xrplRewardTxHash: null,
    status: 'pending_review',
    challengeWindowEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    submittedAt: capturedAt,
    publishedAt: null
  };

  db.gpsEvidence.push(gpsEvidence);
  db.reviews.push(review);
  db.xrplTransactions.push({ id: id('tx'), type: 'review_hash', txHash, reviewId, createdAt: now() });
  addAudit(db, {
    entityType: 'review',
    entityId: review.id,
    action: 'review_submitted',
    fromStatus: null,
    toStatus: 'pending_review',
    actorType: 'expert',
    reason: `GPS within ${Math.round(distance)}m; review hash anchored on XRPL.`,
    xrplTxHash: txHash
  });
  saveDb(db);
  return { message: 'Review submitted. Review hash and GPS evidence hash are on XRPL.', review, gpsEvidence };
}

async function apiCreateMerchantBounty(body) {
  const db = loadDb();
  const wallets = loadWallets();
  const restaurantId = String(body.restaurantId || '');
  const session = requireMerchantLoginSession(body.merchantSessionToken, restaurantId);
  const restaurant = db.restaurants.find((item) => item.id === restaurantId);
  if (!restaurant) throw new Error('Restaurant not found.');
  const merchantWallet = walletFromStored(wallets[session.walletKey]);
  const bountyPoolAddress = wallets.merchantBountyPool?.classicAddress;
  if (!merchantWallet || !bountyPoolAddress) throw new Error('Merchant wallet or bounty pool wallet is missing. Run bootstrap first.');
  const tokenSetup = ensureBountyTokenSetup(wallets);
  const tokenIssuerAddress = wallets.bountyTokenIssuer?.classicAddress;

  const expertCount = Number(body.expertCount);
  const rewardPerExpertXrp = Number(body.rewardPerExpertXrp);
  if (!Number.isInteger(expertCount) || expertCount < 1 || expertCount > 12) throw new Error('Expert count must be between 1 and 12.');
  if (!Number.isFinite(rewardPerExpertXrp) || rewardPerExpertXrp < MIN_BOUNTY_REWARD_XRP) {
    throw new Error(`Reward per expert must be at least ${MIN_BOUNTY_REWARD_XRP} XRP.`);
  }
  const totalXrp = Number((expertCount * rewardPerExpertXrp).toFixed(6));
  const focusArea = String(body.focusArea || 'overall_quality').slice(0, 60);
  const note = String(body.note || '').slice(0, 240);
  const bountyId = id('bounty');
  const createdAt = now();
  const bountyPayload = {
    bountyId,
    restaurantIdHash: sha256(restaurant.id),
    merchantAddress: merchantWallet.classicAddress,
    bountyPoolAddress,
    expertCount,
    rewardPerExpertXrp,
    totalXrp,
    focusArea,
    noteHash: sha256(note || 'no_note'),
    createdAt
  };
  let funding;
  let fundingWarning = null;
  try {
    if (!tokenSetup.ready || !tokenIssuerAddress) {
      throw new Error('Bounty token escrow infrastructure is not ready. Run Admin bootstrap first.');
    }
    funding = await createTokenBountyEscrow({
      merchantWallet,
      bountyPoolAddress,
      tokenIssuerAddress,
      totalXrp,
      bountyPayload
    });
  } catch (err) {
    fundingWarning = `TokenEscrow fallback: ${err.message}`;
    funding = await createXrpBountyEscrow({
      merchantWallet,
      bountyPoolAddress,
      totalXrp,
      bountyPayload
    });
  }
  await withClient(async (client) => {
    wallets[session.walletKey].balanceXrp = await getBalance(client, merchantWallet.classicAddress);
    await refreshBountyTokenBalances(client, wallets);
  });
  const bounty = {
    id: bountyId,
    restaurantId: restaurant.id,
    merchantWalletKey: session.walletKey,
    merchantAddress: merchantWallet.classicAddress,
    bountyPoolAddress,
    expertCount,
    rewardPerExpertXrp,
    totalXrp,
    fundingCurrency: funding.fundingCurrency,
    fundingMethod: funding.fundingMethod,
    focusArea,
    note,
    payloadHash: sha256(bountyPayload),
    fundingTxHash: funding.fundingTxHash,
    escrowCreateTxHash: funding.fundingTxHash,
    escrowSequence: funding.escrowSequence,
    escrowFinishAfter: funding.escrowFinishAfter,
    escrowCancelAfter: funding.escrowCancelAfter,
    escrowFinishTxHash: null,
    fundingWarning,
    assignmentTxHash: null,
    assignedExpertIds: [],
    status: 'locked',
    createdAt,
    assignedAt: null
  };
  db.bounties.push(bounty);
  addAudit(db, {
    entityType: 'bounty',
    entityId: bounty.id,
    action: 'merchant_bounty_funded',
    actorType: 'merchant',
    reason: `${totalXrp} ${funding.fundingCurrency} locked via ${funding.fundingMethod} for ${expertCount} expert visits.`,
    xrplTxHash: funding.fundingTxHash
  });
  saveWallets(wallets);
  saveDb(db);
  return {
    message: fundingWarning
      ? `Bounty locked with ${totalXrp} ${funding.fundingCurrency}. ${fundingWarning}`
      : `Bounty locked with ${totalXrp} ${funding.fundingCurrency} via TokenEscrow.`,
    bounty,
    fundingTxHash: funding.fundingTxHash,
    warning: fundingWarning
  };
}

async function apiAssignBounty(bountyId, { mode, expertIds = [] }) {
  const db = loadDb();
  const wallets = loadWallets();
  const bounty = db.bounties.find((item) => item.id === bountyId);
  if (!bounty) throw new Error('Bounty not found.');
  if (!['funded', 'locked', 'assigned'].includes(bounty.status)) throw new Error('This bounty is not assignable.');
  const issuerWallet = walletFromStored(wallets.adminOperational);
  if (!issuerWallet) throw new Error('Admin issuer wallet is missing. Run bootstrap first.');
  const assignmentDestination = bounty.bountyPoolAddress || wallets.merchantBountyPool?.classicAddress;
  if (!assignmentDestination) throw new Error('Merchant bounty pool address is missing. Run bootstrap first.');
  const activeExperts = db.experts.filter((expert) => expert.status === 'active' && expert.credentialStatus === 'active' && expert.xrplAddress);
  let selectedExperts = [];
  if (mode === 'random') {
    selectedExperts = activeExperts
      .map((expert) => ({ expert, sort: crypto.randomInt(0, 1_000_000) }))
      .sort((a, b) => a.sort - b.sort)
      .map((item) => item.expert)
      .slice(0, bounty.expertCount);
  } else {
    const ids = Array.isArray(expertIds) ? expertIds.map(String) : [];
    selectedExperts = ids.map((expertId) => activeExperts.find((expert) => expert.id === expertId)).filter(Boolean);
  }
  if (selectedExperts.length < bounty.expertCount) throw new Error(`Assign ${bounty.expertCount} active experts for this bounty.`);
  selectedExperts = selectedExperts.slice(0, bounty.expertCount);
  const assignedAt = now();
  const assignmentTxHash = await submitMemoPayment({
    fromWallet: issuerWallet,
    toAddress: assignmentDestination,
    memo: {
      type: 'trustbite_bounty_assignment',
      action: 'bounty_assigned',
      bountyId: bounty.id,
      restaurantIdHash: sha256(bounty.restaurantId),
      assignedExpertAddressHashes: selectedExperts.map((expert) => sha256(expert.xrplAddress)),
      expertCount: selectedExperts.length,
      rewardPerExpertXrp: bounty.rewardPerExpertXrp,
      assignedAt
    }
  });
  const oldStatus = bounty.status;
  bounty.status = 'assigned';
  bounty.assignedExpertIds = selectedExperts.map((expert) => expert.id);
  bounty.assignmentTxHash = assignmentTxHash;
  bounty.assignedAt = assignedAt;
  addAudit(db, {
    entityType: 'bounty',
    entityId: bounty.id,
    action: 'bounty_assigned',
    fromStatus: oldStatus,
    toStatus: 'assigned',
    actorType: 'admin',
    reason: `${selectedExperts.length} experts assigned through ${mode} selection.`,
    xrplTxHash: assignmentTxHash
  });
  saveDb(db);
  return { message: `Bounty assigned to ${selectedExperts.length} experts.`, bounty, assignmentTxHash };
}

async function apiReleaseBountyEscrow(bountyId) {
  const db = loadDb();
  const wallets = loadWallets();
  const bounty = db.bounties.find((item) => item.id === bountyId);
  if (!bounty) throw new Error('Bounty not found.');
  if (!bounty.escrowSequence || !bounty.escrowCreateTxHash) throw new Error('This bounty was not funded through an escrow.');
  if (bounty.escrowFinishTxHash) return { message: 'Escrow already released.', bounty, escrowFinishTxHash: bounty.escrowFinishTxHash };
  const oldStatus = bounty.status;
  const txHash = await finishBountyEscrowOnLedger(wallets, bounty);
  bounty.status = 'released';
  bounty.escrowFinishTxHash = txHash;
  bounty.releasedAt = now();
  addAudit(db, {
    entityType: 'bounty',
    entityId: bounty.id,
    action: 'bounty_escrow_released',
    fromStatus: oldStatus,
    toStatus: 'released',
    actorType: 'admin',
    reason: `${bounty.totalXrp} ${bounty.fundingCurrency || 'XRP'} released from escrow to the bounty pool.`,
    xrplTxHash: txHash
  });
  saveWallets(wallets);
  saveDb(db);
  return { message: 'Bounty escrow released to the bounty pool.', bounty, escrowFinishTxHash: txHash };
}

function apiChallengeReview(reviewId, body) {
  const db = loadDb();
  const review = db.reviews.find((item) => item.id === reviewId);
  if (!review) throw new Error('Review not found.');
  const restaurant = db.restaurants.find((item) => item.id === review.restaurantId);
  if (restaurant?.verifiedStatus !== 'verified') throw new Error('Only verified restaurants can challenge reviews.');
  requireMerchantLoginSession(body.merchantSessionToken, restaurant.id);
  if (!isReviewChallengeWindowOpen(review)) throw new Error('This review is not currently in its merchant challenge window.');
  const oldStatus = review.status;
  review.status = 'challenged';
  const challenge = {
    id: id('challenge'),
    reviewId: review.id,
    restaurantId: restaurant.id,
    merchantId: restaurant.id,
    reason: body.reason || 'gps_mismatch',
    description: body.description || 'Merchant requests admin review.',
    status: 'open',
    createdAt: now(),
    resolvedAt: null
  };
  db.merchantChallenges.push(challenge);
  addAudit(db, {
    entityType: 'review',
    entityId: review.id,
    action: 'merchant_challenge_opened',
    fromStatus: oldStatus,
    toStatus: 'challenged',
    actorType: 'restaurant',
    reason: challenge.reason
  });
  saveDb(db);
  return { message: 'Merchant challenge submitted.', challenge };
}

async function apiPublishReview(reviewId) {
  const db = loadDb();
  const wallets = loadWallets();
  const review = db.reviews.find((item) => item.id === reviewId);
  if (!review) throw new Error('Review not found.');
  if (review.status === 'published') return { message: 'Review already published.', review };
  if (review.status === 'excluded') throw new Error('Excluded reviews cannot be published without correction.');
  const expert = db.experts.find((item) => item.id === review.expertId);
  if (!expert) throw new Error('Expert not found.');
  const rewardWallet = walletFromStored(wallets.reviewRewardPool);
  if (!rewardWallet) throw new Error('ReviewRewardPool wallet is missing. Run bootstrap first.');
  const oldStatus = review.status;
  const txHash = review.xrplRewardTxHash || await submitMemoPayment({
    fromWallet: rewardWallet,
    toAddress: expert.xrplAddress,
    drops: xrpl.xrpToDrops(String(expert.defaultRewardXrp || 2)),
    memo: {
      type: 'review_reward',
      reviewId: review.id,
      restaurantIdHash: review.restaurantIdHash,
      expertId: expert.id,
      amountXrp: expert.defaultRewardXrp || 2,
      paidAt: now()
    }
  });
  review.status = 'published';
  review.publishedAt = now();
  review.xrplRewardTxHash = txHash;
  if (!db.rewardTransactions.find((item) => item.reviewId === review.id)) {
    db.rewardTransactions.push({
      id: id('reward'),
      reviewId: review.id,
      expertId: expert.id,
      rewardPool: 'review_reward_pool',
      amount: String(expert.defaultRewardXrp || 2),
      currency: 'XRP',
      status: 'paid',
      xrplTxHash: txHash,
      createdAt: now(),
      paidAt: now()
    });
  }
  for (const challenge of db.merchantChallenges.filter((item) => item.reviewId === review.id && item.status === 'open')) {
    challenge.status = 'rejected';
    challenge.resolvedAt = now();
  }
  db.xrplTransactions.push({ id: id('tx'), type: 'review_reward', txHash, reviewId: review.id, createdAt: now() });
  addAudit(db, {
    entityType: 'review',
    entityId: review.id,
    action: 'review_published',
    fromStatus: oldStatus,
    toStatus: 'published',
    actorType: 'admin',
    reason: 'Admin finalized review; 2 XRP reward paid from ReviewRewardPool.',
    xrplTxHash: txHash
  });
  saveDb(db);
  return { message: 'Review published and 2 XRP reward paid.', review, rewardTxHash: txHash };
}

function apiExcludeReview(reviewId) {
  const db = loadDb();
  const review = db.reviews.find((item) => item.id === reviewId);
  if (!review) throw new Error('Review not found.');
  const oldStatus = review.status;
  review.status = 'excluded';
  for (const challenge of db.merchantChallenges.filter((item) => item.reviewId === review.id && item.status === 'open')) {
    challenge.status = 'accepted';
    challenge.resolvedAt = now();
  }
  addAudit(db, {
    entityType: 'review',
    entityId: review.id,
    action: 'review_excluded',
    fromStatus: oldStatus,
    toStatus: 'excluded',
    actorType: 'admin',
    reason: 'Admin excluded review after challenge/manual review.'
  });
  saveDb(db);
  return { message: 'Review excluded. It no longer counts toward average rating.', review };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function serveStatic(req, res, pathname) {
  const appRoutes = new Set(['/', '/visitor', '/expert', '/merchant', '/admin']);
  const requested = appRoutes.has(pathname) ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(file) });
    res.end(data);
  });
}

ensureDataDir();
loadDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url.pathname);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (err) {
    json(res, 400, { error: err.message || 'Unexpected error.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TrustBite demo running at http://127.0.0.1:${PORT}`);
  console.log(`XRPL network: ${XRPL_SERVER}`);
  console.log(`XRPL package installed: ${Boolean(xrpl)}`);
});
