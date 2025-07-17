const express = require('express');
const router = express.Router();

// Mock data for demonstration
const mockJobs = [
  {
    id: 'job_001',
    title: 'Tower Crane Operator',
    description: 'Experienced tower crane operator needed for high-rise construction project',
    location: {
      address: '123 Construction Ave',
      city: 'Seattle',
      state: 'WA',
      coordinates: [47.6062, -122.3321]
    },
    requirements: [
      'Valid crane operator certification',
      '5+ years experience',
      'OSHA 10 certification'
    ],
    compensation: {
      rate: 45.00,
      type: 'hourly'
    },
    schedule: {
      start: '2024-01-15T08:00:00Z',
      end: '2024-03-15T17:00:00Z'
    },
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'job_002',
    title: 'Structural Steel Worker',
    description: 'Skilled structural steel worker for commercial building project',
    location: {
      address: '456 Steel St',
      city: 'Portland',
      state: 'OR',
      coordinates: [45.5152, -122.6784]
    },
    requirements: [
      'Structural steel experience',
      'Fall protection certification',
      'Blueprint reading skills'
    ],
    compensation: {
      rate: 38.50,
      type: 'hourly'
    },
    schedule: {
      start: '2024-02-01T07:00:00Z',
      end: '2024-06-30T16:00:00Z'
    },
    status: 'active',
    createdAt: '2024-01-05T00:00:00Z'
  }
];

/**
 * @swagger
 * /api/v1/jobs:
 *   get:
 *     summary: Get list of jobs
 *     tags: [Jobs]
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
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobs:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *                       example: 150
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 8
 */
router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 20, location, status } = req.query;
    
    let filteredJobs = mockJobs;
    
    // Apply filters
    if (location) {
      filteredJobs = filteredJobs.filter(job => 
        job.location.city.toLowerCase().includes(location.toLowerCase()) ||
        job.location.state.toLowerCase().includes(location.toLowerCase())
      );
    }
    
    if (status) {
      filteredJobs = filteredJobs.filter(job => job.status === status);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        jobs: paginatedJobs,
        total: filteredJobs.length,
        page: parseInt(page),
        pages: Math.ceil(filteredJobs.length / limit)
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
 * /api/v1/jobs/{id}:
 *   get:
 *     summary: Get job by ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details retrieved successfully
 *       404:
 *         description: Job not found
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const job = mockJobs.find(j => j.id === id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      data: job
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
 * /api/v1/jobs:
 *   post:
 *     summary: Create a new job
 *     tags: [Jobs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - location
 *               - compensation
 *             properties:
 *               title:
 *                 type: string
 *                 example: Tower Crane Operator
 *               description:
 *                 type: string
 *                 example: Experienced tower crane operator needed
 *               location:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *               compensation:
 *                 type: object
 *                 properties:
 *                   rate:
 *                     type: number
 *                   type:
 *                     type: string
 *                     enum: [hourly, daily, project]
 *     responses:
 *       201:
 *         description: Job created successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/', (req, res) => {
  try {
    const { title, description, location, compensation, requirements, schedule } = req.body;
    
    // Basic validation
    if (!title || !description || !location || !compensation) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const newJob = {
      id: `job_${Date.now()}`,
      title,
      description,
      location,
      compensation,
      requirements: requirements || [],
      schedule: schedule || null,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    mockJobs.push(newJob);
    
    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: newJob
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
