# Local Model Classification Findings (April 13, 2026)

## Setup
- Mac Studio M3 Ultra, 512GB RAM
- Ollama 0.12.6 + llama-cli installed
- vllm-mlx serving Qwen3.5-397B-A17B-4bit on port 8080
- Multiple models available: qwen3:235b, qwen2.5:72b, llama3.1:70b, etc.

## Qwen 397B Test Results
- Model loads and serves successfully via vllm-mlx
- Output is thorough chain-of-thought analysis but uses all tokens on reasoning
- JSON output gets truncated at 8000 tokens — never reaches the actual JSON
- Need to either: increase max_tokens to 16k+, disable thinking mode, or use /no_think flag
- Each card took ~229 seconds (vs ~6 seconds for Sonnet API)
- Analysis quality looks excellent — very thorough field-by-field reasoning

## Next Steps
- Try Qwen with thinking disabled (add /no_think or use non-reasoning mode)
- Try qwen2.5:72b via Ollama (simpler, already tested loading)
- Try Gemma 4 when available via Ollama
- Compare output quality against Sonnet v2 sweep results
- If quality is acceptable, could classify 32k cards for $0 (just time + electricity)

## Cost Comparison
- Sonnet API: $0.046/card → $1,470 for 32k cards
- Sonnet Batch API: ~$0.023/card → ~$735 for 32k cards
- Local model: $0/card but ~4 min/card on 397B (slower), maybe faster on 72B
- At 4 min/card: 32k cards = ~89 days sequential. Would need heavy parallelism.
- At 72B speed (likely ~30s/card): 32k = ~11 days sequential, feasible with parallelism.
