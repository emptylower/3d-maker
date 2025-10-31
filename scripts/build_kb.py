import ast
import html
import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional, Tuple, Union

from bs4 import BeautifulSoup, NavigableString, Tag


BASE_URL = "https://docs.hitem3d.ai"
RAW_DIR = Path("data/raw_html")
ASSET_DIR = Path("data/assets")
OUTPUT_MD_DIR = Path("output/markdown")
MANIFEST_PATH = Path("output/manifest.json")

# Retain the crawl order so manifest entries are deterministic.
PAGES: List[Tuple[str, str]] = [
    ("https://docs.hitem3d.ai/zh/api/api-reference/overview", "zh_api_api-reference_overview.html"),
    ("https://docs.hitem3d.ai/zh/api/api-reference/list/", "zh_api_api-reference_list.html"),
    ("https://docs.hitem3d.ai/zh/api/api-reference/list/create-task", "zh_api_api-reference_list_create-task.html"),
    ("https://docs.hitem3d.ai/zh/api/api-reference/list/get-token", "zh_api_api-reference_list_get-token.html"),
    ("https://docs.hitem3d.ai/zh/api/api-reference/list/query-task", "zh_api_api-reference_list_query-task.html"),
    ("https://docs.hitem3d.ai/zh/api/api-reference/process", "zh_api_api-reference_process.html"),
]

MIN_CHARS = 800
MAX_CHARS = 1200


def ensure_directories() -> None:
    OUTPUT_MD_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)


@dataclass
class Token:
    type: str
    value: Union[str, bool, None, tuple]


@dataclass
class Call:
    name: str
    args: List[Union["Call", str, int, float, bool, None, list, dict]]


def tokenize_js(source: str) -> List[Token]:
    tokens: List[Token] = []
    i = 0
    length = len(source)
    while i < length:
        ch = source[i]
        if ch.isspace():
            i += 1
            continue
        if ch in "(){}[],:.":
            tokens.append(Token(ch, ch))
            i += 1
            continue
        if ch in "'\"`":
            quote = ch
            i += 1
            buf: List[str] = []
            escape = False
            while i < length:
                c = source[i]
                if escape:
                    buf.append(c)
                    escape = False
                elif c == "\\":
                    escape = True
                elif c == quote:
                    break
                else:
                    buf.append(c)
                i += 1
            else:
                raise ValueError("Unterminated string literal")
            tokens.append(Token("STRING", (quote, "".join(buf))))
            i += 1  # skip closing quote
            continue
        if ch.isdigit() or (ch == "-" and i + 1 < length and source[i + 1].isdigit()):
            start = i
            i += 1
            while i < length and (source[i].isdigit() or source[i] == "."):
                i += 1
            tokens.append(Token("NUMBER", source[start:i]))
            continue
        if ch.isalpha() or ch in "_$":
            start = i
            i += 1
            while i < length and (source[i].isalnum() or source[i] in "_$"):
                i += 1
            ident = source[start:i]
            if ident == "true":
                tokens.append(Token("BOOLEAN", True))
            elif ident == "false":
                tokens.append(Token("BOOLEAN", False))
            elif ident == "null":
                tokens.append(Token("NULL", None))
            else:
                tokens.append(Token("IDENT", ident))
            continue
        raise ValueError(f"Unexpected character in JS source: {ch!r}")
    return tokens


class TokenStream:
    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.pos = 0

    def peek(self) -> Optional[Token]:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def peek_next(self) -> Optional[Token]:
        next_pos = self.pos + 1
        return self.tokens[next_pos] if next_pos < len(self.tokens) else None

    def consume(self, expected: Optional[str] = None) -> Token:
        token = self.peek()
        if token is None:
            raise ValueError("Unexpected end of tokens")
        if expected and token.type != expected and token.value != expected:
            raise ValueError(f"Expected {expected}, got {token.type}:{token.value}")
        self.pos += 1
        return token

    def match(self, expected: str) -> bool:
        token = self.peek()
        if token and (token.type == expected or token.value == expected):
            self.pos += 1
            return True
        return False


def decode_string(token: Token) -> str:
    quote, content = token.value  # type: ignore[misc]
    if quote in {"'", '"'}:
        return ast.literal_eval(f"{quote}{content}{quote}")

    # Template literal
    result = content
    # Handle common escape sequences
    result = result.replace("\\`", "`").replace("\\$", "$")
    result = result.replace("\\n", "\n").replace("\\t", "\t").replace("\\r", "\r")
    result = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), result)
    result = re.sub(r"\\x([0-9a-fA-F]{2})", lambda m: chr(int(m.group(1), 16)), result)
    result = result.replace("\\\\", "\\")
    return result


def parse_value(stream: TokenStream):
    token = stream.peek()
    if token is None:
        raise ValueError("Unexpected end while parsing value")
    if token.type == "STRING":
        stream.consume()
        return decode_string(token)
    if token.type == "NUMBER":
        stream.consume()
        text = token.value  # type: ignore[assignment]
        return int(text) if text.isdigit() or (text.startswith("-") and text[1:].isdigit()) else float(text)
    if token.type == "BOOLEAN":
        stream.consume()
        return bool(token.value)
    if token.type == "NULL":
        stream.consume()
        return None
    if token.type == "IDENT":
        # Could be function call or identifier literal
        next_token = stream.peek_next()
        if next_token and next_token.type == "(":
            return parse_call(stream)
        stream.consume()
        return str(token.value)
    if token.type == "(":
        return parse_group(stream)
    if token.type == "{":
        return parse_object(stream)
    if token.type == "[":
        return parse_array(stream)
    raise ValueError(f"Unsupported token type: {token.type}")


def parse_group(stream: TokenStream):
    stream.consume("(")
    value = parse_expression(stream)
    stream.consume(")")
    return value


def parse_array(stream: TokenStream) -> List:
    items: List = []
    stream.consume("[")
    while True:
        if stream.match("]"):
            break
        items.append(parse_expression(stream))
        if stream.match("]"):
            break
        stream.consume(",")
    return items


def parse_object(stream: TokenStream) -> dict:
    obj: dict = {}
    stream.consume("{")
    while True:
        if stream.match("}"):
            break
        key_token = stream.consume()
        if key_token.type == "STRING":
            key = decode_string(key_token)
        elif key_token.type == "IDENT":
            key = str(key_token.value)
        else:
            raise ValueError("Invalid object key")
        stream.consume(":")
        value = parse_expression(stream)
        obj[key] = value
        if stream.match("}"):
            break
        stream.consume(",")
    return obj


def parse_call(stream: TokenStream) -> Call:
    name_token = stream.consume("IDENT")
    name = str(name_token.value)
    stream.consume("(")
    args: List = []
    while True:
        if stream.match(")"):
            break
        args.append(parse_expression(stream))
        if stream.match(")"):
            break
        stream.consume(",")
    return Call(name=name, args=args)


def parse_expression(stream: TokenStream):
    token = stream.peek()
    if token is None:
        raise ValueError("Unexpected end while parsing expression")
    if token.type == "IDENT":
        next_token = stream.peek_next()
        if next_token and next_token.type == "(":
            return parse_call(stream)
        stream.consume()
        return str(token.value)
    if token.type in {"STRING", "NUMBER", "BOOLEAN", "NULL"}:
        return parse_value(stream)
    if token.type == "[":
        return parse_array(stream)
    if token.type == "{":
        return parse_object(stream)
    if token.type == "(":
        return parse_group(stream)
    raise ValueError(f"Unhandled token type in expression: {token.type}")


TAG_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9:-]*$")


def attrs_to_html(attrs: dict) -> str:
    parts: List[str] = []
    for key, value in attrs.items():
        if value in (None, False):
            continue
        if value is True:
            parts.append(html.escape(key))
        else:
            parts.append(f'{html.escape(key)}="{html.escape(str(value), quote=True)}"')
    return (" " + " ".join(parts)) if parts else ""


def expr_to_html(expr) -> str:
    if isinstance(expr, Call):
        return call_to_html(expr)
    if isinstance(expr, list):
        return "".join(expr_to_html(item) for item in expr)
    if isinstance(expr, dict):
        return ""
    if isinstance(expr, (int, float)):
        return str(expr)
    if isinstance(expr, bool):
        return "true" if expr else "false"
    if expr is None:
        return ""
    return html.escape(str(expr))


def call_to_html(call: Call) -> str:
    if not call.args:
        return ""
    first = call.args[0]
    if isinstance(first, str) and first.startswith("<"):
        return first

    if isinstance(first, str) and TAG_PATTERN.match(first):
        tag = first
        idx = 1
        attrs = {}
        children_exprs: List = []
        if idx < len(call.args) and isinstance(call.args[idx], dict):
            attrs = call.args[idx]
            idx += 1
        elif idx < len(call.args) and call.args[idx] is None:
            idx += 1
        if idx < len(call.args):
            child_arg = call.args[idx]
            if isinstance(child_arg, list):
                children_exprs = child_arg
            else:
                children_exprs = [child_arg]
        children_html = "".join(expr_to_html(child) for child in children_exprs)
        attr_str = attrs_to_html(attrs)
        if tag in {"img", "br", "hr", "input"}:
            return f"<{tag}{attr_str} />"
        return f"<{tag}{attr_str}>{children_html}</{tag}>"

    # Treat as text node
    return html.escape(str(first))


def extract_render_expressions(js_text: str) -> List:
    assign_idx = js_text.find("=[")
    if assign_idx == -1:
        return []
    start = assign_idx + 1
    depth = 0
    in_string: Optional[str] = None
    escape = False
    end = None
    for i in range(start, len(js_text)):
        ch = js_text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_string:
                in_string = None
        else:
            if ch in "'\"`":
                in_string = ch
            elif ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        i += 1
    if end is None:
        return []
    array_source = js_text[start : end + 1]
    tokens = tokenize_js(array_source)
    stream = TokenStream(tokens)
    expressions = parse_array(stream)
    return expressions


def locate_js_asset(html_filename: str) -> Path:
    html_path = RAW_DIR / html_filename
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "lxml")
    link = soup.select_one('link[rel="modulepreload"][href*="lean.js"]')
    if not link:
        raise RuntimeError(f"Cannot locate lean asset link in {html_filename}")
    lean_href = link["href"]
    js_name = lean_href.rsplit("/", 1)[-1].replace(".lean.js", ".js")
    js_path = ASSET_DIR / js_name
    if not js_path.exists():
        raise FileNotFoundError(f"Missing JS asset {js_path}")
    return js_path


def extract_page_fragment(js_path: Path) -> Tuple[dict, Tag]:
    text = js_path.read_text(encoding="utf-8")
    data_match = re.search(r"JSON\.parse\('(?P<data>.+?)'\)", text)
    if not data_match:
        raise RuntimeError(f"No page data found in {js_path}")
    page_data = json.loads(data_match.group("data"))

    expressions = extract_render_expressions(text)
    fragments: List[str] = [expr_to_html(expr) for expr in expressions]
    if not fragments:
        raise RuntimeError(f"No HTML fragments extracted from {js_path}")
    html_fragment = "".join(fragments)
    fragment_soup = BeautifulSoup(f"<div>{html_fragment}</div>", "lxml")
    return page_data, fragment_soup.div


def clean_node(root: Tag) -> None:
    """Remove navigation anchors and chrome-only elements."""
    for anchor in root.select("a.header-anchor"):
        anchor.decompose()
    for selector in [
        "button.copy",
        ".copy",
        ".line-numbers-wrapper",
        "span.lang",
    ]:
        for elem in root.select(selector):
            elem.decompose()


def render_inline(node: Tag) -> str:
    parts: List[str] = []
    for child in node.children:
        if isinstance(child, NavigableString):
            parts.append(str(child))
            continue
        if not isinstance(child, Tag):
            continue
        name = child.name
        if name == "code":
            code_text = child.get_text()
            parts.append(f"`{code_text.strip()}`")
        elif name in {"strong", "b"}:
            parts.append(f"**{render_inline(child).strip()}**")
        elif name in {"em", "i"}:
            parts.append(f"*{render_inline(child).strip()}*")
        elif name == "br":
            parts.append("  \n")
        elif name == "a":
            href = child.get("href", "")
            text = render_inline(child).strip()
            if not text:
                continue
            if href.startswith("#"):
                parts.append(text)
            else:
                if href.startswith("/"):
                    href = BASE_URL + href
                parts.append(f"[{text}]({href})" if href else text)
        elif name == "img":
            alt = child.get("alt", "").strip()
            src = child.get("src", "").strip()
            if src.startswith("/"):
                src = BASE_URL + src
            if src:
                parts.append(f"![{alt}]({src})")
        elif name in {"span", "div", "sup", "sub"}:
            parts.append(render_inline(child))
        else:
            parts.append(render_inline(child))
    return "".join(parts).replace("\xa0", " ")


def render_heading(tag: Tag) -> str:
    level = int(tag.name[1])
    text = render_inline(tag).strip()
    return f"{'#' * level} {text}".strip()


def render_paragraph(tag: Tag) -> str:
    return render_inline(tag).strip()


def render_list(tag: Tag, indent: int = 0) -> str:
    lines: List[str] = []
    is_ordered = tag.name == "ol"
    for idx, li in enumerate(tag.find_all("li", recursive=False), start=1):
        prefix = f"{idx}. " if is_ordered else "- "
        body_parts: List[str] = []
        for child in li.children:
            if isinstance(child, NavigableString):
                body_parts.append(str(child))
            elif isinstance(child, Tag) and child.name not in {"ul", "ol"}:
                body_parts.append(render_inline(child))
        body = "".join(body_parts).strip()
        lines.append(" " * indent + prefix + body)
        sub_lists = [c for c in li.children if isinstance(c, Tag) and c.name in {"ul", "ol"}]
        for sub in sub_lists:
            sub_block = render_list(sub, indent + 2)
            if sub_block:
                lines.append(sub_block)
    return "\n".join(lines)


def render_blockquote(tag: Tag) -> str:
    text = render_inline(tag).strip()
    return "\n".join(f"> {line}" if line else ">" for line in text.splitlines())


def render_code_block(tag: Tag) -> str:
    code = tag.find("code")
    language = ""
    if code:
        classes = code.get("class", [])
        language = next((cls.split("-", 1)[-1] for cls in classes if cls.startswith("language-")), "")
    if not language:
        for cls in tag.get("class", []):
            if cls.startswith("language-"):
                language = cls.split("-", 1)[-1]
                break
    if not language and tag.parent:
        for cls in tag.parent.get("class", []):
            if cls.startswith("language-"):
                language = cls.split("-", 1)[-1]
                break
    if code:
        line_spans = code.select(".line")
        if line_spans:
            lines = [span.get_text().replace("\xa0", " ") for span in line_spans]
            content = "\n".join(lines)
        else:
            content = code.get_text()
    else:
        content = tag.get_text()
    fence = f"```{language}".rstrip()
    return f"{fence}\n{content.rstrip()}\n```"


def escape_table_cell(text: str) -> str:
    text = text.replace("\n", "<br>")
    cleaned = text.replace("|", "\\|")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def render_table(tag: Tag) -> str:
    rows: List[List[str]] = []
    header: List[str] = []
    thead = tag.find("thead")
    header_rows = thead.find_all("tr") if thead else []
    if header_rows:
        header = [
            escape_table_cell(render_inline(th).strip())
            for th in header_rows[0].find_all(["th", "td"])
        ]
    body_rows: List[Tag] = []
    tbodies = tag.find_all("tbody")
    if tbodies:
        for body in tbodies:
            body_rows.extend(body.find_all("tr"))
    else:
        body_rows = [tr for tr in tag.find_all("tr") if tr not in header_rows]

    for tr in body_rows:
        cells = [
            escape_table_cell(render_inline(cell).strip())
            for cell in tr.find_all(["th", "td"])
        ]
        if not cells:
            continue
        if not header and tr.find("th"):
            header = cells
            continue
        rows.append(cells)

    if not header and rows:
        header = rows.pop(0)

    col_count = len(header)
    rows = [row + [""] * (col_count - len(row)) for row in rows]

    header_line = "| " + " | ".join(header) + " |"
    separator_line = "| " + " | ".join("---" for _ in header) + " |"
    row_lines = ["| " + " | ".join(row[:col_count]) + " |" for row in rows]
    return "\n".join([header_line, separator_line, *row_lines])


def render_definition_list(tag: Tag) -> str:
    lines: List[str] = []
    for child in tag.children:
        if isinstance(child, Tag):
            if child.name == "dt":
                term = render_inline(child).strip()
                lines.append(f"{term}")
            elif child.name == "dd":
                definition = render_inline(child).strip()
                lines.append(f": {definition}")
    return "\n".join(lines)


def collect_blocks(root: Tag) -> List[str]:
    blocks: List[str] = []
    for child in root.children:
        if isinstance(child, NavigableString):
            if child.strip():
                blocks.append(child.strip())
            continue
        if not isinstance(child, Tag):
            continue
        name = child.name
        if name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            blocks.append(render_heading(child))
        elif name == "p":
            rendered = render_paragraph(child)
            if rendered:
                blocks.append(rendered)
        elif name in {"ul", "ol"}:
            rendered = render_list(child)
            if rendered:
                blocks.append(rendered)
        elif name == "blockquote":
            rendered = render_blockquote(child)
            if rendered:
                blocks.append(rendered)
        elif name == "pre":
            rendered = render_code_block(child)
            if rendered:
                blocks.append(rendered)
        elif name == "table":
            rendered = render_table(child)
            if rendered:
                blocks.append(rendered)
        elif name == "dl":
            rendered = render_definition_list(child)
            if rendered:
                blocks.append(rendered)
        elif name in {"script", "style"}:
            continue
        else:
            blocks.extend(collect_blocks(child))
    return blocks


def chunk_blocks(blocks: Iterable[str], slug: str) -> List[Tuple[str, str]]:
    chunks: List[Tuple[str, str]] = []
    current: List[str] = []
    current_len = 0

    def flush() -> None:
        nonlocal current, current_len
        if not current:
            return
        text = "\n\n".join(current).strip()
        if text:
            chunks.append((text, ""))
        current = []
        current_len = 0

    for block in blocks:
        block_text = block.strip()
        if not block_text:
            continue
        block_len = len(block_text.replace("\n", ""))
        if current and current_len + block_len > MAX_CHARS:
            flush()
        current.append(block_text)
        current_len += block_len
        if block_len >= MAX_CHARS:
            flush()
    flush()

    # Merge small chunks where possible
    def chunk_length(text: str) -> int:
        return len(text.replace("\n", ""))

    i = 0
    while i < len(chunks):
        text, _ = chunks[i]
        if len(chunks) == 1:
            break
        length = chunk_length(text)
        if length < MIN_CHARS:
            merged = False
            if i + 1 < len(chunks):
                next_text, _ = chunks[i + 1]
                combined = f"{text}\n\n{next_text}".strip()
                if chunk_length(combined) <= MAX_CHARS or chunk_length(next_text) < MIN_CHARS:
                    chunks[i] = (combined, "")
                    chunks.pop(i + 1)
                    merged = True
            if not merged and i > 0:
                prev_text, _ = chunks[i - 1]
                combined = f"{prev_text}\n\n{text}".strip()
                if chunk_length(combined) <= MAX_CHARS or chunk_length(prev_text) < MIN_CHARS:
                    chunks[i - 1] = (combined, "")
                    chunks.pop(i)
                    i -= 1
                    merged = True
            if merged:
                continue
        i += 1

    final_chunks: List[Tuple[str, str]] = []
    for idx, (text, _) in enumerate(chunks, start=1):
        chunk_id = f"{slug}-chunk-{idx:02d}"
        final_chunks.append((text, chunk_id))
    return final_chunks


def slug_from_url(url: str) -> str:
    path = url.replace(BASE_URL, "").strip("/")
    parts = [part for part in path.split("/") if part]
    if not parts:
        return "index"
    if parts[-1] in {"create-task", "get-token", "query-task"} and len(parts) >= 2:
        return "-".join(parts[-2:])
    return parts[-1] if parts[-1] != "list" else "list"


def write_markdown_file(
    path: Path,
    title: str,
    source: str,
    retrieved_at: str,
    chunks: List[Tuple[str, str]],
) -> List[str]:
    chunk_ids: List[str] = []
    lines: List[str] = [
        "---",
        f"title: {title}",
        f"source: {source}",
        f"retrieved_at: {retrieved_at}",
        "---",
        "",
    ]
    for text, chunk_id in chunks:
        chunk_ids.append(chunk_id)
        lines.append(f"<!-- chunk_id: {chunk_id} -->")
        lines.append("")
        lines.append(text)
        lines.append("")
    content = "\n".join(lines).rstrip() + "\n"
    path.write_text(content, encoding="utf-8")
    return chunk_ids


def build_manifest_entry(md_path: Path, title: str, source: str, chunk_ids: List[str]) -> dict:
    rel_path = md_path.relative_to(OUTPUT_MD_DIR.parent)
    return {
        "path": str(rel_path).replace("\\", "/"),
        "title": title,
        "source": source,
        "chunk_ids": chunk_ids,
    }


def main() -> None:
    ensure_directories()
    retrieved_at = datetime.utcnow().date().isoformat()
    manifest: List[dict] = []

    for url, html_filename in PAGES:
        js_path = locate_js_asset(html_filename)
        page_data, content_root = extract_page_fragment(js_path)
        clean_node(content_root)
        blocks = collect_blocks(content_root)
        if not blocks:
            raise RuntimeError(f"No content blocks parsed for {url}")
        title = page_data.get("title") or blocks[0].lstrip("# ").strip()
        slug = slug_from_url(url)
        file_path = OUTPUT_MD_DIR / f"{slug}.md"
        chunks = chunk_blocks(blocks, slug)
        chunk_ids = write_markdown_file(file_path, title, url, retrieved_at, chunks)
        manifest.append(build_manifest_entry(file_path, title, url, chunk_ids))

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
