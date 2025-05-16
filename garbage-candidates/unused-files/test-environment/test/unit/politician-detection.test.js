/**
 * Unit tests for politician detection
 */

const politicianDetection = require('../../src/politician-detection');

// Mock politician data for tests
const MOCK_POLITICIANS = [
  { 
    he: 'בנימין נתניהו', 
    en: 'Benjamin Netanyahu', 
    position: 'ראש הממשלה',
    aliases: ['ביבי', 'נתניהו'],
    requiresContext: false
  },
  { 
    he: 'יאיר לפיד', 
    en: 'Yair Lapid', 
    position: 'ראש האופוזיציה',
    aliases: ['לפיד'],
    requiresContext: false
  },
  {
    he: 'יצחק הרצוג',
    en: 'Isaac Herzog',
    position: 'נשיא המדינה',
    aliases: ['בוז׳י', 'הרצוג'],
    requiresContext: false
  },
  {
    he: 'כהנא',
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
      const result = politicianDetection.findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('בנימין נתניהו');
      expect(result.length).toBe(1);
    });
    
    it('should detect politician by alias', () => {
      const text = 'ביבי הודיע היום על תוכנית חדשה';
      const result = politicianDetection.findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('בנימין נתניהו');
      expect(result.length).toBe(1);
    });
    
    it('should detect politician by position', () => {
      const text = 'ראש הממשלה הודיע היום על תוכנית חדשה';
      const result = politicianDetection.findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('בנימין נתניהו');
      expect(result.length).toBe(1);
    });
    
    it('should detect multiple politicians in the same text', () => {
      const text = 'ראש הממשלה נתניהו ויאיר לפיד נפגשו היום';
      const result = politicianDetection.findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('בנימין נתניהו');
      expect(result).toContain('יאיר לפיד');
      expect(result.length).toBe(2);
    });
    
    it('should not detect politicians with required context when context is missing', () => {
      const text = 'כהנא הוא שם משפחה נפוץ בישראל';
      const result = politicianDetection.findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result.length).toBe(0);
    });
    
    it('should detect politicians with required context when context is present', () => {
      const text = 'שר הדתות מתן כהנא הודיע על רפורמה חדשה';
      const result = politicianDetection.findPoliticianMentions(text, MOCK_POLITICIANS);
      
      expect(result).toContain('כהנא');
      expect(result.length).toBe(1);
    });
    
    it('should handle empty text', () => {
      const result = politicianDetection.findPoliticianMentions('', MOCK_POLITICIANS);
      expect(result.length).toBe(0);
    });
    
    it('should handle null text', () => {
      const result = politicianDetection.findPoliticianMentions(null, MOCK_POLITICIANS);
      expect(result.length).toBe(0);
    });
  });
  
  describe('isPositionFormer', () => {
    it('should detect former position with לשעבר after position', () => {
      const text = 'ראש הממשלה לשעבר נפתלי בנט';
      const position = 'ראש הממשלה';
      
      const result = politicianDetection.isPositionFormer(text, position);
      expect(result).toBe(true);
    });
    
    it('should detect former position with הקודם after position', () => {
      const text = 'ראש הממשלה הקודם נפתלי בנט';
      const position = 'ראש הממשלה';
      
      const result = politicianDetection.isPositionFormer(text, position);
      expect(result).toBe(true);
    });
    
    it('should not flag current position as former', () => {
      const text = 'ראש הממשלה בנימין נתניהו';
      const position = 'ראש הממשלה';
      
      const result = politicianDetection.isPositionFormer(text, position);
      expect(result).toBe(false);
    });
  });
}); 