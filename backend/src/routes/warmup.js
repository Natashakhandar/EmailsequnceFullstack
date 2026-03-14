const express = require('express');
const router = express.Router();
const warmupManager = require('../services/warmupManager');
const { authenticateToken } = require('../middleware/auth');

// GET /api/warmup/settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await warmupManager.getSettings(req.user.id);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching warmup settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/warmup/settings
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await warmupManager.updateSettings(req.user.id, req.body);
    res.json({
      message: 'Warmup settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error updating warmup settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/warmup/admin/:userId (SuperAdmin only)
const { requireSuperAdmin } = require('../middleware/auth');
router.get('/admin/:userId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const settings = await warmupManager.getSettings(req.params.userId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching warmup settings for user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
