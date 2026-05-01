#!/usr/bin/env nu

# Define targets
let targets = {
    chrome: "manifest.v3.json",
    firefox: "manifest.v2.json"
}

let src_dir = "src"
let dist_dir = "dist"
let shared_dir = $"($src_dir)/shared"

# Helper function to process a file (compile TS to JS and minify)
def process_file [input_path, output_dir] {
    let ext = ($input_path | path parse | get extension)
    let stem = ($input_path | path parse | get stem)

    if $ext == "ts" {
        # Compile TypeScript to JavaScript and minify in one pass
        bun build $input_path --minify --outfile $"($output_dir)/($stem).js"
    } else if $ext == "js" {
        # Minify JavaScript directly
        bun build $input_path --minify --outfile $"($output_dir)/($stem).js"
    } else {
        # Copy other files as-is
        cp $input_path $"($output_dir)/($input_path | path basename)"
    }
}

# Iterate through targets
for target_name in ($targets | columns) {
    let manifest_file = $targets | get $target_name
    let out_path = $"($dist_dir)/($target_name)"

    # Remove existing directory if it exists
    if ($out_path | path exists) {
        rm -rf $out_path
    }

    # Create output directory
    mkdir $out_path

    # Copy and process all files from shared directory
    ls $shared_dir | each { |file|
        process_file $file.name $out_path
    }

    # Copy manifest file
    cp $"($src_dir)/($manifest_file)" $"($out_path)/manifest.json"

    print $"✅ Built (ansi cyan_bold)($target_name | str upcase)(ansi reset) extension in (ansi green_bold)($out_path)(ansi reset)"
}
