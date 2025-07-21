import request from 'supertest';
import express from 'express';
import { DataService } from '../services/dataService';
import { NaturalLanguageQueryService } from '../services/naturalLanguageQueryService';

// テスト用のExpressアプリを作成
const app = express();
app.use(express.json());

// モックデータサービス
const mockDataService = {
  loadAllOrganizationsActivities: () => ({
    activities: [
      {
        login: 'mm-kado',
        name: 'mm-kado',
        avatar_url: 'https://example.com/avatar1.jpg',
        organization: 'macromill',
        organizationDisplayName: 'macromill',
        activities: {
          '2025-07': {
            issues: 10,
            pullRequests: 5,
            commits: 20,
            reviews: 15
          }
        }
      }
    ],
    organizations: {}
  })
};

// クエリエンドポイントを追加
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const { activities } = mockDataService.loadAllOrganizationsActivities();
    const queryService = new NaturalLanguageQueryService(activities);
    const result = await queryService.processQuery(query);
    
    res.json(result);
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

describe('Natural Language Query API', () => {
  describe('POST /api/query', () => {
    it('should process valid query', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({ query: 'mm-kadoの活動を表示して' })
        .expect(200);

      expect(response.body.type).toBe('data');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].login).toBe('mm-kado');
    });

    it('should return error for missing query', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Query is required');
    });

    it('should handle empty query', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({ query: '' })
        .expect(200);

      expect(response.body.type).toBe('data');
      expect(response.body.data).toBeNull();
    });

    it('should process comparison query', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({ query: 'macromillとmacromill-mintを比較して' })
        .expect(200);

      expect(response.body.type).toBe('comparison');
    });

    it('should process ranking query', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({ query: '最も活動したメンバー上位1人' })
        .expect(200);

      expect(response.body.type).toBe('data');
      expect(response.body.data).toHaveLength(1);
    });
  });
});
