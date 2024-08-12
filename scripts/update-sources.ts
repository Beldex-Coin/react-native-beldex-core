// Run this script as `node -r sucrase/register ./scripts/update-sources.ts`
//
// It will:
// - Download third-party source code.
// - Set up the Android build system:
//    - Determine which C++ headers are actually necessary.
//    - Copy the necessary sources into `android/src/main/cpp`.
//    - Assemble `CMakeLists.txt`.
// - Assemble an iOS universal static library.
// - Generate Flow types from the TypeScript definitions.
//
// This library only uses about 1500 of the 13000 boost headers files,
// so we ask the C compiler which headers are actually useful.

import { execSync } from 'child_process'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { makeNodeDisklet } from 'disklet'

const disklet = makeNodeDisklet(join(__dirname, '../'))
const tmp = join(__dirname, '../tmp')

async function main(): Promise<void> {
  if (!existsSync(tmp)) mkdirSync(tmp)
  await downloadSources()
  await generateAndroidBuild()
  await generateIosLibrary()
  await makeFlowTypes()
}

async function downloadSources(): Promise<void> {
  getZip(
    // The Emscripten SDK includes 1.75, but this older version still works:
    'boost_1_63_0.zip',
    'https://boostorg.jfrog.io/artifactory/main/release/1.63.0/source/boost_1_63_0.zip'
  )
  getRepo(
    'beldex-core-custom',
    'https://github.com/Beldex-Coin/beldex-core-custom.git',
    '63175e7ec8671b5c2c9dbfecbbda6c01d6654659'
  )
  getRepo(
    // Use the webassembly-cleanup branch:
    'beldex-core-cpp',
    'https://github.com/Beldex-Coin/beldex-core-cpp.git',
    'f35b6cc267891b253770b17e267a83667bcaa1a8'
  )
  getRepo(
    'beldex-utils',
    'https://github.com/Beldex-Coin/beldex-utils.git',
    '64bc76a6583020f5ccec6f2dc75554e829bd0f06'
  )
  await disklet.setText(
    // Upstream beldex-utils wrongly includes this file, so make a dummy:
    'tmp/beldex-core-custom/emscripten.h',
    ''
  )
  await copyFiles('src/', 'tmp/', [
    'beldex-wrapper/beldex-methods.cpp',
    'beldex-wrapper/beldex-methods.hpp'
  ])
}

// Preprocessor definitions:
const defines: string[] = [
  'BOOST_ERROR_CODE_HEADER_ONLY',
  'BOOST_SYSTEM_NO_DEPRECATED',
  'BELDEX_CORE_CUSTOM'
]

// Compiler options derived loosely from beldex-core-cpp/CMakeLists.txt:
const includePaths: string[] = [
  'boost_1_63_0/',
  'beldex-core-custom/',
  'beldex-core-custom/contrib/libsodium/include/',
  'beldex-core-custom/contrib/libsodium/include/sodium/',
  'beldex-core-custom/crypto/',
  'beldex-core-custom/cryptonote_basic/',
  'beldex-core-custom/cryptonote_core/',
  'beldex-core-custom/epee/include/',
  'beldex-core-custom/external/',
  'beldex-core-custom/external/loki-mq/',
  'beldex-core-custom/mnemonics/',
  'beldex-core-custom/vtlogger/',
  'beldex-core-custom/wallet/',
  'beldex-core-cpp/src/'
]

// Source list derived loosely from beldex-core-cpp/CMakeLists.txt:
const sources: string[] = [
  'boost_1_63_0/libs/thread/src/pthread/once.cpp',
  'boost_1_63_0/libs/thread/src/pthread/thread.cpp',
  'beldex-core-custom/common/aligned.c',
  'beldex-core-custom/common/base58.cpp',
  'beldex-core-custom/common/threadpool.cpp',
  'beldex-core-custom/common/util.cpp',
  'beldex-core-custom/common/i18n.cpp',
  'beldex-core-custom/common/string_util.cpp',
  'beldex-core-custom/contrib/libsodium/src/crypto_verify/verify.c',
  'beldex-core-custom/crypto/aesb.c',
  'beldex-core-custom/crypto/blake256.c',
  'beldex-core-custom/crypto/chacha.c',
  'beldex-core-custom/crypto/crypto-ops-data.c',
  'beldex-core-custom/crypto/crypto-ops.c',
  'beldex-core-custom/crypto/crypto.cpp',
  'beldex-core-custom/crypto/groestl.c',
  'beldex-core-custom/crypto/hash-extra-blake.c',
  'beldex-core-custom/crypto/hash-extra-groestl.c',
  'beldex-core-custom/crypto/hash-extra-jh.c',
  'beldex-core-custom/crypto/hash-extra-skein.c',
  'beldex-core-custom/crypto/hash.c',
  'beldex-core-custom/crypto/cn_heavy_hash_hard_arm.cpp',
  'beldex-core-custom/crypto/cn_heavy_hash_soft.cpp',
  'beldex-core-custom/crypto/jh.c',
  'beldex-core-custom/crypto/keccak.c',
  'beldex-core-custom/crypto/oaes_lib.c',
  'beldex-core-custom/crypto/random.c',
  'beldex-core-custom/crypto/skein.c',
  'beldex-core-custom/crypto/slow-hash-dummied.cpp',
  'beldex-core-custom/crypto/tree-hash.c',
  'beldex-core-custom/cryptonote_basic/account.cpp',
  'beldex-core-custom/cryptonote_basic/cryptonote_basic.cpp',
  'beldex-core-custom/cryptonote_basic/cryptonote_basic_impl.cpp',
  'beldex-core-custom/cryptonote_basic/cryptonote_format_utils.cpp',
  'beldex-core-custom/cryptonote_core/cryptonote_tx_utils.cpp',
  'beldex-core-custom/device/device_default.cpp',
  'beldex-core-custom/device/device.cpp',
  'beldex-core-custom/epee/src/hex.cpp',
  'beldex-core-custom/epee/src/memwipe.c',
  'beldex-core-custom/epee/src/mlocker.cpp',
  'beldex-core-custom/epee/src/string_tools.cpp',
  'beldex-core-custom/epee/src/portable_storage.cpp',
  'beldex-core-custom/epee/src/wipeable_string.cpp',
  'beldex-core-custom/mnemonics/electrum-words.cpp',
  'beldex-core-custom/ringct/bulletproofs.cc',
  'beldex-core-custom/ringct/multiexp.cc',
  'beldex-core-custom/ringct/rctCryptoOps.c',
  'beldex-core-custom/ringct/rctOps.cpp',
  'beldex-core-custom/ringct/rctSigs.cpp',
  'beldex-core-custom/ringct/rctTypes.cpp',
  'beldex-core-custom/vtlogger/logger.cpp',
  'beldex-core-cpp/src/beldex_address_utils.cpp',
  'beldex-core-cpp/src/beldex_fee_utils.cpp',
  'beldex-core-cpp/src/beldex_fork_rules.cpp',
  'beldex-core-cpp/src/beldex_key_image_utils.cpp',
  'beldex-core-cpp/src/beldex_paymentID_utils.cpp',
  'beldex-core-cpp/src/beldex_send_routine.cpp',
  'beldex-core-cpp/src/beldex_transfer_utils.cpp',
  'beldex-core-cpp/src/beldex_wallet_utils.cpp',
  'beldex-core-cpp/src/serial_bridge_index.cpp',
  'beldex-core-cpp/src/serial_bridge_utils.cpp',
  'beldex-core-cpp/src/tools__ret_vals.cpp',
  'beldex-utils/src/emscr_SendFunds_bridge.cpp',
  'beldex-utils/src/SendFundsFormSubmissionController.cpp',
  'beldex-wrapper/beldex-methods.cpp'
]

// Phones and simulators we need to support:
const iosPlatforms: Array<{ sdk: string; arch: string }> = [
  { sdk: 'iphoneos', arch: 'arm64' },
  { sdk: 'iphonesimulator', arch: 'arm64' }
]
const iosSdkTriples: { [sdk: string]: string } = {
  iphoneos: '%arch%-apple-ios13.0',
  iphonesimulator: '%arch%-apple-ios13.0-simulator'
}

/**
 * Set up the Android build system.
 */
async function generateAndroidBuild() {
  // Clean existing stuff:
  console.log('Generating Android....................');
  const src = 'android/src/main/cpp/'
  await disklet.delete(src + 'boost_1_63_0')
  await disklet.delete(src + 'beldex-core-custom')
  await disklet.delete(src + 'beldex-core-cpp')
  await disklet.delete(src + 'beldex-utils')
  await disklet.delete(src + 'beldex-wrapper')

  // Figure out which files we need:
  const headers = inferHeaders()
  const extraFiles: string[] = [
    // Preserve licenses:
    'boost_1_63_0/LICENSE_1_0.txt',
    'beldex-core-cpp/LICENSE.txt',

    // Platform-specific files our header inference might not catch:
    'boost_1_63_0/boost/atomic/detail/ops_cas_based.hpp',
    'boost_1_63_0/boost/atomic/detail/ops_extending_cas_based.hpp',
    'boost_1_63_0/boost/atomic/detail/ops_gcc_x86_dcas.hpp',
    'boost_1_63_0/boost/config/platform/linux.hpp',
    'boost_1_63_0/boost/detail/fenv.hpp',
    'boost_1_63_0/boost/uuid/detail/uuid_generic.hpp',
    'boost_1_63_0/boost/uuid/detail/uuid_x86.hpp'
  ]
  for (const extra of extraFiles) {
    if (headers.indexOf(extra) >= 0) {
      console.log(`Warning: ${extra} isn't needed in extraFiles`)
    }
  }
  await copyFiles('tmp/', src, [...sources, ...headers, ...extraFiles])

  // Assemble our CMakeLists.txt:
  const sourceList = ['jni.cpp', ...sources].join(' ')
  const cmakeLines = [
    '# Auto-generated by the update-sources script',
    'project("react-native-beldex-core")',
    'cmake_minimum_required(VERSION 3.4.1)',
    'add_compile_options(-fvisibility=hidden -w)',
    ...defines.map(name => `add_definitions("-D${name}")`),
    ...includePaths.map(path => `include_directories("${path}")`),
    `add_library(beldex-jni SHARED ${sourceList})`
  ]
  await disklet.setText(src + 'CMakeLists.txt', cmakeLines.join('\n'))
}

/**
 * Uses the C compiler to figure out exactly which headers we need.
 * Boost includes about 13,000 header files, which is insane.
 * This reduces the number of headers to about 1500, which much better,
 * but still slightly insane.
 */
function inferHeaders(): string[] {
  const cflags = [
    ...defines.map(name => `-D${name}`),
    ...includePaths.map(path => `-I${join(tmp, path)}`),
    '-Wno-error=reserved-user-defined-literal'
  ]
  const cxxflags = [...cflags, '-std=c++17']

  const out: { [path: string]: true } = {}
  for (const source of sources) {
    console.log(`Finding headers in ${source}...`)

    const useCxx = /\.cpp$|\.cc$/.test(source)
    const report = quietExec([
      'clang',
      '-M',
      ...(useCxx ? cxxflags : cflags),
      join(tmp, source)
    ])

    // Skip the first 2 lines & trim trailing back-slashes:
    const headers = report
      .split('\n')
      .slice(2)
      .map(line => line.replace(/ |\\$/g, ''))

    // We only care about headers located in our tmp/ location:
    for (const header of headers) {
      if (header.indexOf(tmp) === 0) {
        out[header.slice(tmp.length + 1)] = true
      }
    }
  }

  return Object.keys(out)
}

/**
 * Compiles the sources into an iOS static library.
 */
async function generateIosLibrary(): Promise<void> {
  console.log('Generating iOS library.......................');
  const cflags = [
    ...defines.map(name => `-D${name}`),
    ...includePaths.map(path => `-I${join(tmp, path)}`),
    '-miphoneos-version-min=13.0',
    '-O2',
    '-Werror=partial-availability',
    '-Wno-error=reserved-user-defined-literal',
    '-D_LIBCPP_ENABLE_CXX17_REMOVED_AUTO_PTR',
    '-D_LIBCPP_ENABLE_CXX17_REMOVED_UNARY_BINARY_FUNCTION'
  ]
  const cxxflags = [...cflags, '-std=c++17']

  // Generate a library for each platform:
  const libraries: string[] = []
  for (const { sdk, arch } of iosPlatforms) {
    const working = join(tmp, `${sdk}-${arch}`)
    if (!existsSync(working)) mkdirSync(working)

    // Find platform tools:
    const xcrun = ['xcrun', '--sdk', sdk]
    const ar = quietExec([...xcrun, '--find', 'ar'])
    const cc = quietExec([...xcrun, '--find', 'clang'])
    const cxx = quietExec([...xcrun, '--find', 'clang++'])
    const sdkFlags = [
      '-arch',
      arch,
      '-target',
      iosSdkTriples[sdk].replace('%arch%', arch),
      '-isysroot',
      quietExec([...xcrun, '--show-sdk-path'])
    ]

    // Compile sources:
    const objects: string[] = []
    for (const source of sources) {
      console.log(`Compiling ${source} for ${sdk}-${arch}...`)

      // Figure out the object file name:
      const object = join(
        working,
        source.replace(/^.*\//, '').replace(/\.c$|\.cc$|\.cpp$/, '.o')
      )
      objects.push(object)

      const useCxx = /\.cpp$|\.cc$/.test(source)
      quietExec([
        useCxx ? cxx : cc,
        '-c',
        ...(useCxx ? cxxflags : cflags),
        ...sdkFlags,
        `-o ${object}`,
        join(tmp, source)
      ])
    }

    // Generate a static library:
    console.log(`Building static library for ${sdk}-${arch}...`)
    const library = join(working, `libbeldex-core.a`)
    if (existsSync(library)) unlinkSync(library)
    libraries.push(library)
    quietExec([ar, 'rcs', library, ...objects])
  }

  // Merge the platforms into a fat library:
  const merged: string[] = []
  const sdks = new Set(iosPlatforms.map(row => row.sdk))
  for (const sdk of sdks) {
    console.log(`Merging libraries for ${sdk}...`)
    const working = join(tmp, `${sdk}-lipo`)
    if (!existsSync(working)) mkdirSync(working)
    const output = join(working, 'libbeldex-core.a')
    merged.push('-library', output)
    quietExec([
      'lipo',
      '-create',
      '-output',
      output,
      ...libraries.filter((_, i) => iosPlatforms[i].sdk === sdk)
    ])
  }

  // Bundle those into an XCFramework:
  console.log('Creating XCFramework...')
  await disklet.delete('ios/BeldexCore.xcframework')
  quietExec([
    'xcodebuild',
    '-create-xcframework',
    ...merged,
    '-output',
    join(__dirname, '../ios/BeldexCore.xcframework')
  ])
}

/**
 * Turns the TypeScript types into Flow types.
 */
async function makeFlowTypes(): Promise<void> {
  const ts = await disklet.getText('src/index.d.ts')
  await disklet.setText(
    'src/index.js.flow',
    '// @flow\n' + ts.replace(/readonly /g, '+')
  )
}

/**
 * Clones a git repo and checks our a hash.
 */
function getRepo(name: string, uri: string, hash: string): void {
  const path = join(tmp, name)

  // Clone (if needed):
  if (!existsSync(path)) {
    console.log(`Cloning ${name}...`)
    loudExec(['git', 'clone', uri, name])
  }

  // Checkout:
  console.log(`Checking out ${name}...`)
  execSync(`git checkout -f ${hash}`, {
    cwd: path,
    stdio: 'inherit',
    encoding: 'utf8'
  })
}

/**
 * Downloads & unpacks a zip file.
 */
function getZip(name: string, uri: string): void {
  const path = join(tmp, name)

  if (!existsSync(path)) {
    console.log(`Getting ${name}...`)
    loudExec(['curl', '-L', '-o', path, uri])
  }

  // Unzip:
  loudExec(['unzip', '-u', path])
}

/**
 * Copies just the files we need from one folder to another.
 */
async function copyFiles(
  from: string,
  to: string,
  files: string[]
): Promise<void> {
  for (const file of files) {
    await disklet.setText(to + file, await disklet.getText(from + file))
  }
}

/**
 * Runs a command and returns its results.
 */
function quietExec(argv: string[]): string {
  return execSync(argv.join(' '), {
    cwd: tmp,
    encoding: 'utf8'
  }).replace(/\n$/, '')
}

/**
 * Runs a command and displays its results.
 */
function loudExec(argv: string[]): void {
  execSync(argv.join(' '), {
    cwd: tmp,
    stdio: 'inherit',
    encoding: 'utf8'
  })
}

main().catch(error => console.log(error))
