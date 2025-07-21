import { NaturalLanguageQueryService } from '../services/naturalLanguageQueryService';
import { MemberActivity } from '../types';

// テスト用のモックデータ
const mockActivities: MemberActivity[] = [
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
      },
      '2025-08': {
        issues: 8,
        pullRequests: 3,
        commits: 15,
        reviews: 12
      }
    }
  },
  {
    login: 'test-user',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar2.jpg',
    organization: 'macromill-mint',
    organizationDisplayName: 'macromill-mint',
    activities: {
      '2025-07': {
        issues: 5,
        pullRequests: 2,
        commits: 10,
        reviews: 8
      }
    }
  }
];

describe('NaturalLanguageQueryService', () => {
  let service: NaturalLanguageQueryService;

  beforeEach(() => {
    service = new NaturalLanguageQueryService(mockActivities);
  });

  describe('processQuery', () => {
    it('should process basic member query', async () => {
      const result = await service.processQuery('mm-kadoの活動を表示して');
      
      expect(result.type).toBe('data');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].login).toBe('mm-kado');
      expect(result.message).toContain('1件のデータが見つかりました');
    });

    it('should process organization comparison query', async () => {
      const result = await service.processQuery('macromillとmacromill-mintを比較して');
      
      expect(result.type).toBe('comparison');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].organization).toBe('macromill');
      expect(result.data[1].organization).toBe('macromill-mint');
    });

    it('should process ranking query', async () => {
      const result = await service.processQuery('最も活動したメンバー上位2人');
      
      expect(result.type).toBe('data');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].total).toBeGreaterThanOrEqual(result.data[1].total);
    });

    it('should process analysis query', async () => {
      const result = await service.processQuery('活動を分析して');
      
      expect(result.type).toBe('analysis');
      expect(result.data.totalMembers).toBe(2);
      expect(result.data.totalIssues).toBeGreaterThan(0);
    });

    it('should process aggregation query', async () => {
      const result = await service.processQuery('活動の合計を集計して');
      
      expect(result.type).toBe('summary');
      expect(result.data.sum.issues).toBeGreaterThan(0);
      expect(result.data.average.issues).toBeGreaterThan(0);
    });

    it('should handle empty query result', async () => {
      const result = await service.processQuery('存在しないメンバーの活動を表示して');
      
      expect(result.type).toBe('data');
      expect(result.data).toHaveLength(0);
      expect(result.message).toContain('0件のデータが見つかりました');
    });

    it('should handle error gracefully', async () => {
      // 無効なクエリでもエラーにならないことを確認
      const result = await service.processQuery('');
      
      expect(result.type).toBe('data');
      expect(result.data).toBeNull();
    });
  });

  describe('query parsing', () => {
    it('should extract members correctly', async () => {
      const result = await service.processQuery('mm-kadoとtest-userの活動を表示して');
      
      expect(result.filters?.members).toContain('mm-kado');
      expect(result.filters?.members).toContain('test-user');
    });

    it('should extract organizations correctly', async () => {
      const result = await service.processQuery('macromillの活動を表示して');
      
      expect(result.filters?.organizations).toContain('macromill');
    });

    it('should extract activity types correctly', async () => {
      const result = await service.processQuery('イシュー数が多いメンバーを表示して');
      
      expect(result.filters?.activityTypes).toContain('issues');
    });

    it('should extract date range correctly', async () => {
      const result = await service.processQuery('今月の活動を表示して');
      
      expect(result.filters?.dateRange).toBeDefined();
      expect(result.filters?.dateRange?.start).toBeDefined();
      expect(result.filters?.dateRange?.end).toBeDefined();
    });
  });

  describe('filtering and sorting', () => {
    it('should filter by minimum value', async () => {
      const result = await service.processQuery('イシュー数が5個以上のメンバーを表示して');
      
      expect(result.data.every((member: any) => member.issues >= 5)).toBe(true);
    });

    it('should sort by specified field', async () => {
      const result = await service.processQuery('コミット数でソートして');
      
      expect(result.data[0].commits).toBeGreaterThanOrEqual(result.data[1].commits);
    });

    it('should limit results', async () => {
      const result = await service.processQuery('上位1人のメンバーを表示して');
      
      expect(result.data).toHaveLength(1);
    });
  });
});
