# Placeholder Text Standardization Plan

## Goal
Make placeholder text consistent, descriptive, and follow proper format across all forms and game inputs in the codebase.

## Current Placeholder Analysis

### Private Pages Forms (5 forms)

| Component | Element | Current Placeholder | Issue |
|-----------|---------|--------------------|-------|
| NoteForm | textarea | "Apa yang kamu rasakan hari ini?" | ✅ Good - descriptive |
| AddMilestoneForm | title input | "Contoh: First Date" | ✅ Good - example format |
| WishForm | title input | "Apa yang kalian inginkan?" | ✅ Good - descriptive question |
| NewLetterForm | title input | "Contoh: Untuk kamu yang selalu ada" | ✅ Good - example format |
| NewLetterForm | editor | "Mulai dengan "Hai sayang…" — lalu ceritakan apa yang ingin kamu sampaikan." | ⚠️ Long, could be shorter |
| NotesManager | textarea | "Apa yang kamu rasakan hari ini?" | ✅ Same as NoteForm |

### Games (2 inputs)

| Component | Element | Current Placeholder | Issue |
|-----------|---------|--------------------|-------|
| TriviaQuiz | answer input | "Ketik jawabanmu..." | ✅ Good - imperative verb |
| PublicGameClient | player name | "Nama kamu..." | ✅ Good - simple, but missing "..." consistency |

## Standardization Rules

### 1. Title/Input Placeholders
- **Format**: `Contoh: [example]` for example-driven inputs, or descriptive question for others
- **Consistency**: Use same style within related component groups
- **Capitalization**: Sentence case, first word capitalized

### 2. Content/Editor Placeholders
- **Format**: Short prompt, "Mulai dengan..." pattern
- **Max length**: ~20-30 words, not full sentences

### 3. Game Inputs
- **Format**: Imperative verb + "mu/mu..." for casual tone, or descriptive
- **Consistency**: Match the game's existing tone

## Recommended Changes

### 1. NewLetterForm Editor Placeholder (line 351)
**Current**: `placeholder="Mulai dengan "Hai sayang…" — lalu ceritakan apa yang ingin kamu sampaikan."`
**Recommended**: `placeholder="Mulai dengan "Hai sayang…" lalu ceritakan apa yang ingin kamu sampaikan."` (remove quotes around "Hai sayang…" or simplify)

### 2. TriviaQuiz Answer Placeholder (line 218)
**Current**: `placeholder="Ketik jawabanmu..."`
**Keep as-is** ✅ - already good format

### 3. PublicGameClient Player Name (line 113)
**Current**: `placeholder="Nama kamu..."`
**Recommended**: `placeholder="Nama kamu"` (remove trailing "..." for consistency with other name inputs, or keep if preferred)

Actually, looking at the pattern, "Nama kamu..." with ellipsis is fine for game contexts. Let me reconsider...

**Better**: Keep `placeholder="Nama kamu..."` since it's a game and the ellipsis fits the casual tone.

### 4. Consistency Check - All Title Placeholders
| Form | Placeholder | Format |
|------|-------------|--------|
| AddMilestoneForm | "Contoh: First Date" | `Contoh: ...` example format ✅ |
| WishForm | "Apa yang kalian inginkan?" | Descriptive question ✅ |
| NewLetterForm title | "Contoh: Untuk kamu yang selalu ada" | `Contoh: ...` example format ✅ |
| NoteForm/NotesManager | "Apa yang kamu rasakan hari ini?" | Descriptive question ✅ |

**Issue**: Mixed formats - some use `Contoh: ...`, some use descriptive questions.

**Decision needed**: Should all title placeholders use the same format?

### 5. Cross-Component Patterns
- **Note/textarea forms**: Descriptive question about content
- **Title inputs**: Either `Contoh: example` or direct question
- **Game inputs**: Casual, imperative, or descriptive based on game tone

## Migration Plan

### Phase 1: Quick Wins (already partially done)
- [x] NewLetterForm buttons: variant consistency
- [x] LetterEditor toolbar: single-row mobile

### Phase 2: Placeholder Text
1. **NewLetterForm editor placeholder** - simplify from long quote to concise prompt
2. **Standardize title placeholder format** across all private page forms (decide on one format)
3. **Game placeholders** - verify TriviaQuiz and PublicGameClient are appropriate

### Phase 3: Validation
- Test all forms load with new placeholder text
- Verify no truncation issues on mobile
- Confirm placeholder disappears on focus in all browsers

## Open Decisions Needed from User

### Decision 1: Title Placeholder Format
Should all title inputs use the same format?
- **Option A**: All use `Contoh: [example]` format (AddMilestoneForm, NewLetterForm)
- **Option B**: Mix of `Contoh: ...` for example-driven + descriptive questions for others
- **Option C**: All use descriptive questions (WishForm, NoteForm style)

**Recommended**: **Option A** - unify to `Contoh: ...` format for all title inputs, as it's more instructional for users. This makes AddMilestoneForm and NewLetterForm consistent, while NoteForm/NotesManager (content-only) keep their descriptive format.

### Decision 2: NoteForm/NotesManager title
Should these content-only forms add a title field, or keep as-is?
- Keep content-only but standardize placeholder to descriptive question format ✅ (no change needed)

### Decision 3: Game placeholders
- TriviaQuiz `Ketik jawabanmu...` ✅ keep
- PublicGameClient `Nama kamu...` ✅ keep (game context)

## Final Plan Summary

**Immediate changes (no user decision required):**
1. Simplify NewLetterForm editor placeholder from long quote to concise prompt
2. Keep game placeholders as-is (they're context-appropriate)

**Requires user decision:**
1. Choose title placeholder format: `Contoh: ...` unified vs mixed formats

**Which decision do you want to make first?** Or shall I proceed with the immediate changes while you decide on the title format?