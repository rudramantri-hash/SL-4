# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Amazon.com":
    - /url: /ref=cs_503_logo
    - img "Amazon.com" [ref=e2] [cursor=pointer]
  - search [ref=e3]:
    - generic [ref=e4]:
      - textbox "Search" [ref=e5]
      - button "Go" [ref=e6] [cursor=pointer]
  - generic [ref=e7]:
    - link "Sorry! Something went wrong on our end. Please go back and try again or go to Amazon's home page." [ref=e9] [cursor=pointer]:
      - /url: /ref=cs_503_link
      - img "Sorry! Something went wrong on our end. Please go back and try again or go to Amazon's home page." [ref=e10] [cursor=pointer]
    - link "Dogs of Amazon" [ref=e11] [cursor=pointer]:
      - /url: /dogsofamazon/ref=cs_503_d
      - img "Dogs of Amazon" [ref=e12] [cursor=pointer]
```