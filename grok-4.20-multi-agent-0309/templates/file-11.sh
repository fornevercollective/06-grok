# First time setup
cd rust && cargo build
cd ../python && uv sync
cd ../node && npm install

# Then run everything:
make multi
