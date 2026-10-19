import { describe,it,expect } from 'vitest';
import {deckName,normalizeQuestion} from '../src/lib/format';
describe('module naming and duplicate normalization',()=>{
 it('uses semester and module in the Anki deck name',()=>expect(deckName('3. Semester','Deterministische Signale und Systeme')).toBe('3. Semester::Deterministische Signale und Systeme'));
 it('ignores punctuation and case',()=>expect(normalizeQuestion('Was ist ein LTI-System?')).toBe(normalizeQuestion('WAS IST EIN LTI SYSTEM')));
});
