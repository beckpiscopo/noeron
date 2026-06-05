"""Prompt templates and response-parsing helpers for Gemini calls."""

import re

DEEP_DIVE_PROMPT_TEMPLATE_TECHNICAL = """You are a scientific reviewer writing for a technically literate audience (graduate-level biology/biophysics).

Given a podcast claim and supporting research papers, produce a concise but technical synthesis that foregrounds mechanisms, quantitative findings, and study design quality.

## CLAIM FROM PODCAST
"{claim_text}"

Speaker's stance: {speaker_stance}
Why this needs backing: {needs_backing}

## SUPPORTING EVIDENCE FROM RAG RETRIEVAL
{evidence_summary}

## YOUR TASK
Write a 250-400 word synthesis with this exact structure:

**Finding (technical)**: 2-3 sentences stating what the evidence shows. Include quantitative effects (with units) and directionality when present.

**Mechanism / Pathway**: 2-4 sentences describing the mechanistic model. Name relevant pathways, molecules, tissues, model systems, and causal links proposed or demonstrated.

**Evidence Appraisal**: 3-5 bullet points. Each bullet must note study design (e.g., RCT, observational, in vitro, in vivo), model/organism, sample size (n or replicates), key result (magnitude/direction), and whether it is a replication/extension.

**Limitations & Open Questions**: 2-4 bullet points on uncertainties, conflicting findings, methodological gaps, or external validity issues.

**Implications**: 1-2 sentences on what the evidence enables (e.g., therapeutic targets, experimental follow-ups, engineering applications).

## ALSO REQUIRED - PER-PAPER KEY FINDINGS
At the end, include a section with key findings for each paper. Use this exact format:

[PAPER_KEY_FINDINGS]
Paper 1: <one sentence summarizing this paper's key contribution to the claim>
Paper 2: <one sentence summarizing this paper's key contribution to the claim>
Paper 3: <one sentence summarizing this paper's key contribution to the claim>
(continue for all papers listed above)
[/PAPER_KEY_FINDINGS]

## GUIDELINES
- Keep language precise and technical; avoid hand-waving
- Prefer concrete numbers, effect sizes, and experimental conditions over generalities
- Distinguish clearly between demonstrated findings and speculation
- If evidence is weak, heterogeneous, or conflicting, say so explicitly
- Keep output scannable while preserving detail (bullets where specified)

Respond with ONLY the structured summary followed by the paper key findings section, no preamble."""

DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED = """You are a science communicator explaining research to an educated but non-specialist audience.

Given a podcast claim and supporting papers, write a clear, scannable summary that highlights what the evidence actually shows.

## CLAIM FROM PODCAST
"{claim_text}"

Speaker's stance: {speaker_stance}
Why this needs backing: {needs_backing}

## SUPPORTING EVIDENCE FROM RAG RETRIEVAL
{evidence_summary}

## YOUR TASK
Write a 180-260 word summary with this exact structure:

**Finding**: One sentence stating what the studies collectively show (be specific).

**Why It Matters**: 2-3 sentences on the biological/medical significance in plain language.

**Evidence Strength**: Classify as "Strong", "Emerging", or "Contested" and justify in 1-2 sentences.

**Key Uncertainties**: 2-3 bullet points of caveats, gaps, or disagreements.

## ALSO REQUIRED - PER-PAPER KEY FINDINGS
At the end, include a section with key findings for each paper. Use this exact format:

[PAPER_KEY_FINDINGS]
Paper 1: <one sentence summarizing this paper's key contribution to the claim>
Paper 2: <one sentence summarizing this paper's key contribution to the claim>
Paper 3: <one sentence summarizing this paper's key contribution to the claim>
(continue for all papers listed above)
[/PAPER_KEY_FINDINGS]

## GUIDELINES
- Use active voice and concrete details; avoid jargon
- Separate demonstrated findings from speculation
- If evidence is weak or limited, say so clearly
- Keep the tone clear and honest; no preamble

Respond with ONLY the structured summary followed by the paper key findings section, no preamble."""

# Alias kept for any callers that import this name directly
DEEP_DIVE_PROMPT_TEMPLATE = DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED

EVIDENCE_THREAD_PROMPT = """You are analyzing scientific papers to identify distinct "evidence threads" - coherent research narratives that trace how understanding of a claim developed over time.

CLAIM: "{claim_text}"

RETRIEVED PAPERS:
{papers_json}

TASK:
Identify 2-4 distinct evidence threads that show how scientific understanding of this claim was built. Look for:

1. **Experimental Progressions**: Initial observations → mechanism discovery → validation → refinement
2. **Theoretical Developments**: Concept introduction → formalization → empirical testing → application
3. **Cross-Domain Generalizations**: Finding in one system → replication in other systems → general principle
4. **Converging Evidence**: Different research approaches reaching same conclusion

THREAD TYPES:
- experimental_validation: Direct experimental tests of the claim
- theoretical_framework: Conceptual/mathematical models supporting the claim
- mechanism_discovery: Research uncovering how/why the phenomenon works
- cross_domain: Evidence from multiple organisms/systems showing generality

THREAD STRENGTH:
- foundational: Well-established with multiple replications and broad acceptance
- developing: Emerging evidence with some replication but ongoing investigation
- speculative: Initial findings or theoretical proposals needing more validation

OUTPUT FORMAT (valid JSON only):
{{
  "threads": [
    {{
      "name": "Brief thread name (3-6 words)",
      "type": "experimental_validation|theoretical_framework|mechanism_discovery|cross_domain",
      "strength": "foundational|developing|speculative",
      "milestones": [
        {{
          "year": 2020,
          "paper_title": "Exact title from papers above",
          "paper_id": "ID from papers above",
          "finding": "One concise sentence: what this paper contributed to the thread"
        }}
      ],
      "narrative": "2-3 sentences describing the overall research arc of this thread"
    }}
  ]
}}

CRITICAL RULES:
- Only cite papers from the RETRIEVED PAPERS list above
- Include 2-4 milestones per thread (not more)
- Order milestones chronologically within each thread
- Each milestone must reference a real paper from the list
- If you cannot identify at least 2 distinct threads, return {{"threads": []}}
- Output ONLY valid JSON, no markdown formatting or preamble
"""


def _parse_paper_key_findings(summary: str, num_papers: int) -> list[str]:
    """Parse per-paper key findings from the [PAPER_KEY_FINDINGS] block in a summary."""
    match = re.search(r'\[PAPER_KEY_FINDINGS\](.*?)\[/PAPER_KEY_FINDINGS\]', summary, re.DOTALL)
    if not match:
        return [""] * num_papers

    findings_text = match.group(1).strip()
    findings = []
    for i in range(1, num_papers + 1):
        pattern = rf'Paper\s*{i}\s*:\s*(.+?)(?=Paper\s*\d+\s*:|$)'
        paper_match = re.search(pattern, findings_text, re.DOTALL | re.IGNORECASE)
        if paper_match:
            finding = ' '.join(paper_match.group(1).strip().split())
            findings.append(finding)
        else:
            findings.append("")
    return findings


def _extract_summary_without_findings(summary: str) -> str:
    """Strip the [PAPER_KEY_FINDINGS] block from a summary for display."""
    cleaned = re.sub(r'\[PAPER_KEY_FINDINGS\].*?\[/PAPER_KEY_FINDINGS\]', '', summary, flags=re.DOTALL)
    return cleaned.strip()
