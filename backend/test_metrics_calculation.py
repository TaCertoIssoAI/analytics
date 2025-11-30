import sys
import os
from datetime import datetime

# Add project root to path
sys.path.append(os.getcwd())

from app.models.input_format import AnaliseInputFormat, ClaimInputFormat, ResponseByDataSourceInputFormat, ClaimVerdictInputFormat, ReasoningSourceInputFormat
from app.services.transformer import transformer
from app.models.new_format import AnaliseNewFormat

def test_metrics_calculation():
    print("🧪 Testing metrics calculation...")

    # Mock input data
    input_data = AnaliseInputFormat(
        DocumentId="test_doc_123",
        Date=datetime.utcnow().isoformat(),
        message_type="FromWhatsappGroup",
        PureText="Test message",
        FinalTranscribedText="Test message",
        ScrapedLinks=[],
        HadAudio=False,
        HadImage=False,
        HadVideo=False,
        Claims={
            "1": ClaimInputFormat(text="Claim 1"),
            "2": ClaimInputFormat(text="Claim 2"),
            "3": ClaimInputFormat(text="Claim 3"),
            "4": ClaimInputFormat(text="Claim 4")
        },
        ResponseByDataSource=[
            ResponseByDataSourceInputFormat(
                data_source_id="test_source_1",
                data_source_type="link_context",
                claim_verdicts=[
                    ClaimVerdictInputFormat(
                        claim_id="1",
                        claim_text="Claim 1",
                        Result="Verdadeiro",
                        reasoningText="Reasoning 1",
                        reasoningSources=[]
                    ),
                    ClaimVerdictInputFormat(
                        claim_id="2",
                        claim_text="Claim 2",
                        Result="Falso",
                        reasoningText="Reasoning 2",
                        reasoningSources=[]
                    ),
                    ClaimVerdictInputFormat(
                        claim_id="3",
                        claim_text="Claim 3",
                        Result="Enganoso", # Should count as unverified/other in current logic
                        reasoningText="Reasoning 3",
                        reasoningSources=[]
                    ),
                     ClaimVerdictInputFormat(
                        claim_id="4",
                        claim_text="Claim 4",
                        Result="Verdadeiro",
                        reasoningText="Reasoning 4",
                        reasoningSources=[]
                    )
                ]
            )
        ],
        FinalResponseText="Overall verdict",
        CommentAboutCompleteContext="Comment"
    )

    # Transform
    result: AnaliseNewFormat = transformer.transform(input_data)

    # Check metrics
    metrics = result.analysis_metrics
    print(f"📊 Metrics: {metrics}")

    assert metrics.total_claims == 4, f"Expected 4 total claims, got {metrics.total_claims}"
    assert metrics.true_count == 2, f"Expected 2 true, got {metrics.true_count}" # Claim 1 and 4
    assert metrics.fake_count == 1, f"Expected 1 fake, got {metrics.fake_count}" # Claim 2
    assert metrics.unverified_count == 1, f"Expected 1 unverified, got {metrics.unverified_count}" # Claim 3 (Enganoso)

    # Check scores
    # True: 2/4 = 50.0
    # Fake: 1/4 = 25.0
    # Unverified: 1/4 = 25.0
    assert metrics.truth_score == 50.0, f"Expected 50.0 truth score, got {metrics.truth_score}"
    assert metrics.fake_score == 25.0, f"Expected 25.0 fake score, got {metrics.fake_score}"
    assert metrics.unverified_score == 25.0, f"Expected 25.0 unverified score, got {metrics.unverified_score}"

    print("✅ Metrics calculation test passed!")

if __name__ == "__main__":
    try:
        test_metrics_calculation()
    except AssertionError as e:
        print(f"❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
