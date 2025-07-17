const express = require('express');
const router = express.Router();

// Mock data for demonstration
const mockWorkers = [
  {
    id: 'worker_001',
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1-555-0123',
    skills: ['Crane Operation', 'Heavy Equipment', 'Safety Management'],
    certifications: [
      {
        name: 'NCCCO Mobile Crane Operator',
        issueDate: '2023-01-15',
        expiryDate: '2025-01-15',
        status: 'active'
      },
      {
        name: 'OSHA 30-Hour',
        issueDate: '2023-03-20',
        expiryDate: '2026-03-20',
        status: 'active'
      }
    ],
    location: {
      city: 'Seattle',
      state: 'WA',
      coordinates: [47.6062, -122.3321]
    },
    availability: 'available',
    rating: 4.8,
    completedJobs: 127,
    createdAt: '2023-01-01T00:00:00Z'
  },
  {
    id: 'worker_002',
    name: 'Maria Rodriguez',
    email: 'maria.rodriguez@email.com',
    phone: '+1-555-0456',
    skills: ['Structural Steel', 'Welding', 'Blueprint Reading'],
    certifications: [
      {
        name: 'AWS Certified Welder',
        issueDate: '2022-09-10',
        expiryDate: '2024-09-10',
        status: 'active'
      },
      {
        name: 'Fall Protection Certification',
        issueDate: '2023-06-15',
        expiryDate: '2025-06-15',
        status: 'active'
      }
    ],
    location: {
      city: 'Portland',
      state: 'OR',
      coordinates: [45.5152, -122.6784]
    },
    availability: 'available',
    rating: 4.9,
    completedJobs: 89,
    createdAt: '2023-02-15T00:00:00Z'
  }
];

/**
 * @swagger
 * /api/v1/workers:
 *   get:
 *     summary: Get list of workers
 *     tags: [Workers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *         description: Filter by skills (comma-separated)
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: availability
 *         schema:
 *           type: string
 *           enum: [available, busy, unavailable]
 *         description: Filter by availability
 *     responses:
 *       200:
 *         description: List of workers retrieved successfully
 */
router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 20, skills, location, availability } = req.query;
    
    let filteredWorkers = mockWorkers;
    
    // Apply filters
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim().toLowerCase());
      filteredWorkers = filteredWorkers.filter(worker => 
        worker.skills.some(skill => 
          skillsArray.some(filterSkill => 
            skill.toLowerCase().includes(filterSkill)
          )
        )
      );
    }
    
    if (location) {
      filteredWorkers = filteredWorkers.filter(worker => 
        worker.location.city.toLowerCase().includes(location.toLowerCase()) ||
        worker.location.state.toLowerCase().includes(location.toLowerCase())
      );
    }
    
    if (availability) {
      filteredWorkers = filteredWorkers.filter(worker => worker.availability === availability);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedWorkers = filteredWorkers.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        workers: paginatedWorkers,
        total: filteredWorkers.length,
        page: parseInt(page),
        pages: Math.ceil(filteredWorkers.length / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/workers/{id}:
 *   get:
 *     summary: Get worker by ID
 *     tags: [Workers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: Worker details retrieved successfully
 *       404:
 *         description: Worker not found
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const worker = mockWorkers.find(w => w.id === id);
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }
    
    res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/workers/{id}/certifications:
 *   get:
 *     summary: Get worker certifications
 *     tags: [Workers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: Worker certifications retrieved successfully
 *       404:
 *         description: Worker not found
 */
router.get('/:id/certifications', (req, res) => {
  try {
    const { id } = req.params;
    const worker = mockWorkers.find(w => w.id === id);
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        workerId: id,
        certifications: worker.certifications
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/workers/{id}/compliance-check:
 *   post:
 *     summary: Perform compliance verification for worker
 *     tags: [Workers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: Compliance check completed successfully
 *       404:
 *         description: Worker not found
 */
router.post('/:id/compliance-check', (req, res) => {
  try {
    const { id } = req.params;
    const worker = mockWorkers.find(w => w.id === id);
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }
    
    // Mock compliance check logic
    const now = new Date();
    const complianceResults = {
      workerId: id,
      complianceStatus: 'compliant',
      checkedAt: now.toISOString(),
      results: {
        certifications: {
          status: 'valid',
          expiredCount: 0,
          expiringCount: 0
        },
        insurance: {
          status: 'valid',
          expiryDate: '2024-12-31'
        },
        backgroundCheck: {
          status: 'passed',
          completedAt: '2023-01-01'
        }
      }
    };
    
    res.json({
      success: true,
      data: complianceResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
