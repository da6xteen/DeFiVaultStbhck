import request from 'supertest';
import express from 'express';
import { authenticateJWT } from '../auth';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

const app = express();
app.use(express.json());
app.get('/test-auth', authenticateJWT, (req, res) => {
  res.status(200).json({ user: req.user });
});

describe('authenticateJWT Middleware', () => {
  it('should return 401 if Authorization header is missing', async () => {
    const response = await request(app).get('/test-auth');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication token missing');
  });

  it('should return 401 if token is invalid', async () => {
    const response = await request(app)
      .get('/test-auth')
      .set('Authorization', 'Bearer invalid-token');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });

  it('should call next() and attach user if token is valid', async () => {
    const payload = { userId: 'user-123', walletAddress: 'wallet-123' };
    const token = jwt.sign(payload, config.JWT_SECRET);

    const response = await request(app)
      .get('/test-auth')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual(payload);
  });
});
