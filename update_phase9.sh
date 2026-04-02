#!/bin/bash
# Phase 9-A Tools (852-853)
sed -i '' '852,853c\
                   <input type="radio" name="tool-hbar-front" id="tool-hbar-ref-front" value="hbar-ref" class="tool-radio">\
                   <label for="tool-hbar-ref-front" class="tool-label"><i data-lucide="minus"></i> 水平基準プロット</label>\
                   \
                   <input type="radio" name="tool-hbar-front" id="tool-hbar-bar-front" value="hbar-bar" class="tool-radio">\
                   <label for="tool-hbar-bar-front" class="tool-label"><i data-lucide="minus"></i> ホリゾンタルバーのプロット</label>' index.html

# Phase 9-A Buttons (856-857)
sed -i '' '856,857c\
                   <button class="btn btn-outline rotate-hbar-ref-btn"><i data-lucide="align-horizontal-justify-center"></i> 水平基準にあわせる</button>' index.html

# Phase 9-B Tools (912-913)
sed -i '' '912,913c\
                   <input type="radio" name="tool-hbar-top" id="tool-hbar-ref-top" value="hbar-ref" class="tool-radio">\
                   <label for="tool-hbar-ref-top" class="tool-label"><i data-lucide="minus"></i> 水平基準プロット</label>\
                   \
                   <input type="radio" name="tool-hbar-top" id="tool-hbar-bar-top" value="hbar-bar" class="tool-radio">\
                   <label for="tool-hbar-bar-top" class="tool-label"><i data-lucide="minus"></i> ホリゾンタルバーのプロット</label>' index.html

# Phase 9-B Buttons (916-917)
sed -i '' '916,917c\
                   <button class="btn btn-outline rotate-hbar-ref-btn"><i data-lucide="align-horizontal-justify-center"></i> 水平基準にあわせる</button>' index.html
