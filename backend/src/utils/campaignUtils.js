/**
 * Campaign Utility Functions
 * Safe campaign creation and validation utilities
 */

const prisma = require('../db/prismaClient');

/**
 * Safely create a campaign with comprehensive validation
 * @param {Object} data - Campaign data
 * @param {string} data.campaignName - Campaign name (camelCase)
 * @param {string} data.campaign_name - Campaign name (snake_case, fallback)
 * @param {string} data.sequenceId - Sequence ID (camelCase)
 * @param {string} data.sequence_id - Sequence ID (snake_case, fallback)
 * @param {string} [data.description] - Campaign description
 * @param {string|Date} [data.startDate] - Start date
 * @param {string|Date} [data.start_date] - Start date (snake_case, fallback)
 * @param {string|Date} [data.endDate] - End date
 * @param {string|Date} [data.end_date] - End date (snake_case, fallback)
 * @param {boolean} [data.isActive=true] - Whether campaign is active
 * @param {Array<string>} [data.leadIds] - Lead IDs to add to campaign
 * @param {Array<string>} [data.lead_ids] - Lead IDs (snake_case, fallback)
 * @returns {Promise<Object>} Created campaign with relations
 */
async function createCampaignSafely(data) {
  console.log('🔧 Creating campaign with safe validation...');
  
  // Extract and validate data with fallbacks
  const {
    campaignName,
    campaign_name, // API snake_case fallback
    sequenceId,
    sequence_id, // API snake_case fallback
    description = null,
    startDate = null,
    start_date = null, // API snake_case fallback
    endDate = null,
    end_date = null, // API snake_case fallback
    isActive = true,
    leadIds = [],
    lead_ids = [] // API snake_case fallback
  } = data;

  // Map API fields to Prisma fields with fallbacks
  const finalCampaignName = campaignName || campaign_name;
  const finalSequenceId = sequenceId || sequence_id;
  const finalStartDate = startDate || start_date;
  const finalEndDate = endDate || end_date;
  const finalLeadIds = leadIds.length > 0 ? leadIds : lead_ids;

  console.log('📝 Input validation:', {
    finalCampaignName: finalCampaignName ? `"${finalCampaignName}"` : 'undefined',
    finalSequenceId: finalSequenceId ? `"${finalSequenceId}"` : 'undefined',
    finalStartDate,
    finalEndDate,
    leadCount: finalLeadIds.length
  });

  // Enhanced validation with detailed error messages
  if (!finalCampaignName) {
    const error = 'Missing campaignName: Must provide either campaignName or campaign_name';
    console.error('❌', error);
    throw new Error(error);
  }

  if (!finalSequenceId) {
    const error = 'Missing sequenceId: Must provide either sequenceId or sequence_id';
    console.error('❌', error);
    throw new Error(error);
  }

  if (typeof finalCampaignName !== 'string' || finalCampaignName.trim().length === 0) {
    const error = `Invalid campaignName: Must be a non-empty string, got ${typeof finalCampaignName}`;
    console.error('❌', error);
    throw new Error(error);
  }

  if (typeof finalSequenceId !== 'string' || finalSequenceId.trim().length === 0) {
    const error = `Invalid sequenceId: Must be a non-empty string, got ${typeof finalSequenceId}`;
    console.error('❌', error);
    throw new Error(error);
  }

  // Verify sequence exists and is active
  console.log('🔍 Verifying sequence exists...');
  const sequence = await prisma.sequence.findUnique({
    where: { id: finalSequenceId.trim() },
    select: { id: true, name: true, isActive: true }
  });

  if (!sequence) {
    const error = `Sequence not found: ${finalSequenceId}`;
    console.error('❌', error);
    throw new Error(error);
  }

  if (!sequence.isActive) {
    const error = `Sequence is inactive: ${finalSequenceId} (${sequence.name})`;
    console.error('❌', error);
    throw new Error(error);
  }

  console.log('✅ Sequence validation passed:', sequence.name);

  // Verify lead IDs exist if provided
  if (finalLeadIds.length > 0) {
    console.log(`🔍 Verifying ${finalLeadIds.length} lead IDs...`);
    
    const existingContacts = await prisma.contact.findMany({
      where: { id: { in: finalLeadIds } },
      select: { id: true, email: true }
    });

    const existingContactIds = existingContacts.map(c => c.id);
    const missingContactIds = finalLeadIds.filter(id => !existingContactIds.includes(id));

    if (missingContactIds.length > 0) {
      const error = `Some contact IDs not found: ${missingContactIds.join(', ')}`;
      console.error('❌', error);
      throw new Error(error);
    }

    console.log(`✅ All ${finalLeadIds.length} lead IDs validated`);
  }

  // Prepare campaign data with proper types and trimming
  const campaignData = {
    campaignName: finalCampaignName.trim(),
    sequenceId: finalSequenceId.trim(),
    description: description ? description.trim() : null,
    startDate: finalStartDate ? new Date(finalStartDate) : null,
    endDate: finalEndDate ? new Date(finalEndDate) : null,
    isActive: Boolean(isActive)
  };

  console.log('📝 Final campaign data:', {
    ...campaignData,
    startDate: campaignData.startDate?.toISOString(),
    endDate: campaignData.endDate?.toISOString()
  });

  // Create campaign with transaction safety
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create campaign
      const campaign = await tx.campaign.create({
        data: campaignData,
        include: {
          sequence: {
            include: { steps: true }
          }
        }
      });

      console.log('✅ Campaign created:', {
        id: campaign.id,
        name: campaign.campaignName,
        sequence: campaign.sequence.name
      });

      // Add leads to campaign if provided
      if (finalLeadIds.length > 0) {
        await tx.campaignLead.createMany({
          data: finalLeadIds.map(contactId => ({
            campaignId: campaign.id,
            contactId
          }))
        });

        console.log(`✅ Added ${finalLeadIds.length} leads to campaign`);

        // Create enrollments for all leads
        const enrollmentData = finalLeadIds.map(contactId => ({
          contactId,
          sequenceId: finalSequenceId.trim(),
          campaignId: campaign.id,
          currentStep: 1,
          status: 'ACTIVE',
          nextSendAt: new Date(),
          startedAt: new Date()
        }));

        await tx.enrollment.createMany({
          data: enrollmentData
        });

        console.log(`✅ Created ${finalLeadIds.length} enrollments`);
      }

      return campaign;
    });

    console.log('✅ Campaign creation transaction completed successfully');
    return result;

  } catch (error) {
    console.error('❌ Campaign creation failed:', error.message);
    
    // Enhanced error messages for common issues
    if (error.message.includes('Foreign key constraint')) {
      if (error.message.includes('sequenceId')) {
        throw new Error(`Invalid sequence ID: ${finalSequenceId} does not exist`);
      }
      if (error.message.includes('contactId')) {
        throw new Error('One or more contact IDs are invalid');
      }
    }
    
    if (error.message.includes('Unique constraint')) {
      throw new Error('Campaign name must be unique or a duplicate relationship exists');
    }

    throw error;
  }
}

/**
 * Validate campaign data without creating
 * @param {Object} data - Campaign data to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateCampaignData(data) {
  try {
    const {
      campaignName,
      campaign_name,
      sequenceId,
      sequence_id
    } = data;

    const finalCampaignName = campaignName || campaign_name;
    const finalSequenceId = sequenceId || sequence_id;

    const errors = [];

    // Required field validation
    if (!finalCampaignName) {
      errors.push('Missing campaignName: Must provide either campaignName or campaign_name');
    } else if (typeof finalCampaignName !== 'string' || finalCampaignName.trim().length === 0) {
      errors.push(`Invalid campaignName: Must be a non-empty string, got ${typeof finalCampaignName}`);
    }

    if (!finalSequenceId) {
      errors.push('Missing sequenceId: Must provide either sequenceId or sequence_id');
    } else if (typeof finalSequenceId !== 'string' || finalSequenceId.trim().length === 0) {
      errors.push(`Invalid sequenceId: Must be a non-empty string, got ${typeof finalSequenceId}`);
    }

    // If basic validation passes, check sequence existence
    if (errors.length === 0) {
      const sequence = await prisma.sequence.findUnique({
        where: { id: finalSequenceId.trim() },
        select: { id: true, name: true, isActive: true }
      });

      if (!sequence) {
        errors.push(`Sequence not found: ${finalSequenceId}`);
      } else if (!sequence.isActive) {
        errors.push(`Sequence is inactive: ${finalSequenceId} (${sequence.name})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data: {
        campaignName: finalCampaignName?.trim(),
        sequenceId: finalSequenceId?.trim()
      }
    };

  } catch (error) {
    return {
      valid: false,
      errors: [`Validation error: ${error.message}`],
      data: null
    };
  }
}

/**
 * Get default test values for campaign creation
 * @returns {Promise<Object>} Default test values
 */
async function getDefaultTestValues() {
  try {
    // Find an active sequence for testing
    const sequence = await prisma.sequence.findFirst({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    if (!sequence) {
      throw new Error('No active sequences found for testing');
    }

    return {
      campaignName: `Test Campaign ${Date.now()}`,
      sequenceId: sequence.id,
      description: 'Auto-generated test campaign',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      isActive: true
    };

  } catch (error) {
    console.error('❌ Failed to get default test values:', error.message);
    throw error;
  }
}

module.exports = {
  createCampaignSafely,
  validateCampaignData,
  getDefaultTestValues
};
