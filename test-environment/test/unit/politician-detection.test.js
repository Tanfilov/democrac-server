/**
 * Unit tests for politician detection
 */

const { findPoliticianMentions } = require('../../../src/politician-detection/politicianDetectionService');

// Mock politician data for tests
const MOCK_POLITICIANS = [
  { 
    name: 'בנימין נתניהו', 
    en: 'Benjamin Netanyahu', 
    position: 'ראש הממשלה',
    aliases: ['ביבי', 'נתניהו'],
    requiresContext: false
  },
  { 
    name: 'יאיר לפיד', 
    en: 'Yair Lapid', 
    position: 'ראש האופוזיציה',
    aliases: ['לפיד'],
    requiresContext: false
  },
  {
    name: 'יצחק הרצוג',
    en: 'Isaac Herzog',
    position: 'נשיא המדינה',
    aliases: ['בוז׳י', 'הרצוג'],
    requiresContext: false
  },
  {
    name: 'כהנא',
    en: 'Kahana',
    position: '',
    aliases: [],
    requiresContext: true,
    contextIdentifiers: ['מתן', 'שר הדתות', 'משרד הדתות']
  }
];

describe('Politician Detection Module', () => {
  
  describe('findPoliticianMentions', () => {
    it('should detect politician by name', () => {
      const text = 'ראש הממשלה בנימין נתניהו הודיע היום על תוכנית חדשה';
      const result = findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('בנימין נתניהו');
      expect(result.length).toBe(1);
    });
    
    it('should detect politician by alias', () => {
      const text = 'ביבי הודיע היום על תוכנית חדשה';
      const result = findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('בנימין נתניהו');
      expect(result.length).toBe(1);
    });
    
    it('should detect politician by position', () => {
      const text = 'ראש הממשלה הודיע היום על תוכנית חדשה';
      const result = findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('בנימין נתניהו');
      expect(result.length).toBe(1);
    });
    
    it('should detect multiple politicians in the same text', () => {
      const text = 'ראש הממשלה נתניהו ויאיר לפיד נפגשו היום';
      const result = findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('בנימין נתניהו');
      expect(result).toContain('יאיר לפיד');
      expect(result.length).toBe(2);
    });
    
    it('should not detect politicians with required context when context is missing', () => {
      const text = 'כהנא הוא שם משפחה נפוץ בישראל';
      const result = findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result.length).toBe(0);
    });
    
    it('should detect politicians with required context when context is present', () => {
      const text = 'שר הדתות מתן כהנא הודיע על רפורמה חדשה';
      const result = findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('כהנא');
      expect(result.length).toBe(1);
    });
    
    it('should handle empty text', () => {
      const result = findPoliticianMentions('', MOCK_POLITICIANS);
      expect(result.length).toBe(0);
    });
    
    it('should handle null text', () => {
      const result = findPoliticianMentions(null, MOCK_POLITICIANS);
      expect(result.length).toBe(0);
    });
  });
}); 