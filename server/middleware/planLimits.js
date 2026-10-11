const db = require('../config/db');

// Cache: { [restaurantId]: { features, planName, expiresAt } }
const planFeatureCache = new Map();

/**
 * Retrieves the feature flags for a given restaurant's current subscription plan.
 * @param {string} restaurantId
 * @returns {Promise<{ features: object, planName: string }>}
 */
async function getRestaurantPlanFeatures(restaurantId) {
  if (!restaurantId) {
    return { features: {}, planName: 'None' };
  }

  const now = Date.now();
  const cached = planFeatureCache.get(restaurantId);
  if (cached && cached.expiresAt > now) {
    return { features: cached.features, planName: cached.planName };
  }

  try {
    // 1. Check active or trialing subscription
    const subRes = await db.query(
      `SELECT sp.name, sp.features 
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.restaurant_id = $1 AND s.status IN ('active', 'trialing')
       ORDER BY s.created_at DESC LIMIT 1`,
      [restaurantId]
    );

    if (subRes.rows[0]) {
      const { name, features } = subRes.rows[0];
      const parsedFeatures = typeof features === 'string' ? JSON.parse(features) : (features || {});
      planFeatureCache.set(restaurantId, { features: parsedFeatures, planName: name, expiresAt: now + 60000 });
      return { features: parsedFeatures, planName: name };
    }

    // 2. Check restaurant trial status
    const restRes = await db.query(
      `SELECT status, trial_ends_at FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (restRes.rows[0]) {
      const rest = restRes.rows[0];
      const isInTrial = rest.trial_ends_at && new Date(rest.trial_ends_at) > new Date();

      if (isInTrial) {
        // Active 14-day free trial gets Growth tier features for evaluation
        const trialFeatures = {
          kds: true,
          inventory: true,
          delivery: true,
          loyalty: true,
          api_access: false,
          multi_branch: false
        };
        planFeatureCache.set(restaurantId, { features: trialFeatures, planName: 'Growth (Trial)', expiresAt: now + 60000 });
        return { features: trialFeatures, planName: 'Growth (Trial)' };
      }
    }

    // 3. Fallback: Starter features
    const defaultFeatures = {
      kds: false,
      inventory: false,
      delivery: false,
      loyalty: false,
      api_access: false,
      multi_branch: false
    };
    planFeatureCache.set(restaurantId, { features: defaultFeatures, planName: 'Starter', expiresAt: now + 60000 });
    return { features: defaultFeatures, planName: 'Starter' };
  } catch (err) {
    console.error('Error fetching plan features:', err.message);
    return { features: {}, planName: 'Error' };
  }
}

/**
 * Programmatic check if a restaurant currently has a feature flag enabled.
 */
async function hasPlanFeature(restaurantId, featureName) {
  const { features } = await getRestaurantPlanFeatures(restaurantId);
  return Boolean(features[featureName]);
}

/**
 * Express middleware requiring a specific subscription feature flag.
 * Usage: router.get('/...', authenticate, requireTenant, requirePlanFeature('loyalty'), handler)
 */
function requirePlanFeature(featureName) {
  return async (req, res, next) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      return res.status(401).json({ error: 'Unauthorized: missing restaurant context' });
    }

    const { features, planName } = await getRestaurantPlanFeatures(restaurantId);

    if (!features[featureName]) {
      return res.status(403).json({
        error: `The '${featureName}' feature is not included in your current subscription plan (${planName}). Please upgrade your plan to access this feature.`,
        code: 'PLAN_FEATURE_LOCKED',
        feature: featureName,
        currentPlan: planName
      });
    }

    req.planFeatures = features;
    req.planName = planName;
    next();
  };
}

/** Invalidate cache on plan change */
function invalidatePlanCache(restaurantId) {
  if (restaurantId) {
    planFeatureCache.delete(restaurantId);
  } else {
    planFeatureCache.clear();
  }
}

module.exports = {
  getRestaurantPlanFeatures,
  hasPlanFeature,
  requirePlanFeature,
  invalidatePlanCache
};
