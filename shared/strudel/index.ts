// Strudel code analysis — static, evaluation-free (strudel-code-analysis
// spec). Importable from the server, the client (`#shared/strudel`) and
// plain `node` scripts (`shared/strudel/index.ts`, via type stripping).
export { analyzeStrudel, locateAt, unknownNames } from './analyze.ts'
export type {
  AnalysisError,
  CallSite,
  Location,
  MiniModifier,
  MiniNode,
  MiniString,
  NameUse,
  Position,
  StrudelAnalysis,
} from './types.ts'
