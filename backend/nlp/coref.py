"""
Phase 5 -- Co-reference Resolution.

Replaces pronouns and vague references with resolved entity names
before NER runs, improving extraction accuracy on FIR narratives.
"""

import spacy

_nlp = None


def load_coref_model():
    global _nlp
    if _nlp is None:
        # Install: pip install spacy-experimental
        # python -m spacy download en_coreference_web_trf
        try:
            _nlp = spacy.load("en_coreference_web_trf")
        except OSError:
            print("Co-reference model not found. Using basic resolution.")
            _nlp = "basic"
    return _nlp


def resolve_coreferences(text: str) -> str:
    """
    Replace pronouns and vague references with resolved entity names.
    Falls back to rule-based resolution if model unavailable.
    """
    nlp = load_coref_model()

    if nlp == "basic":
        return _basic_resolution(text)

    try:
        doc = nlp(text)
        resolved = text

        # Replace each cluster's mentions with the main mention
        if hasattr(doc, "spans"):
            for key in doc.spans:
                if key.startswith("coref_cluster"):
                    cluster = doc.spans[key]
                    if len(cluster) > 1:
                        main_mention = cluster[0].text
                        for mention in cluster[1:]:
                            resolved = resolved.replace(mention.text, main_mention, 1)

        return resolved
    except Exception as e:
        print(f"Co-reference resolution failed: {e}. Using original text.")
        return text


def _basic_resolution(text: str) -> str:
    """
    Rule-based fallback: replace common FIR pronouns with
    placeholder markers for downstream processing.
    """
    replacements = {
        "the accused": "[ACCUSED]",
        "the complainant": "[COMPLAINANT]",
        "the said vehicle": "[VEHICLE_REF]",
        "the above vehicle": "[VEHICLE_REF]",
        "the same": "[SAME_REF]",
        "the first accused": "[ACCUSED_1]",
        "the second accused": "[ACCUSED_2]",
        "the third accused": "[ACCUSED_3]",
    }
    resolved = text
    for phrase, marker in replacements.items():
        resolved = resolved.replace(phrase, marker)
    return resolved
