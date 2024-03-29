import { spawn, spawnSync } from 'child_process';

export function metadata({ source, tags, useBufferLimit = true, maxBufferSize = 10000, callback }) {
  return new Promise((resolve, reject) => {
    process.nextTick(() => {
      if (!source) {
        let error = new TypeError('"source" must be a string, [string] or Buffer')
        tryCallback(callback, error)
        reject(error)
      }
      let exifparams = prepareTags(tags)
      // "-j" json output
      exifparams.push('-j')

      let usingBuffer = false

      if (Buffer.isBuffer(source)) {
        usingBuffer = true
        exifparams.push('-')
      } else if (typeof source === 'string') {
        exifparams.push(source)
      } else if (Array.isArray(source)) {
        exifparams = exifparams.concat(source)
      } else {
        let error = new TypeError('"source" must be a string, [string] or Buffer')
        tryCallback(callback, error)
        reject(error)
      }

      let exif = spawn('exiftool', exifparams)
      let exifdata = ''
      let exiferr = ''

      if (usingBuffer) {
        let buf = useBufferLimit ? source.slice(0, maxBufferSize) : source
        exif.stdin.write(buf)
        exif.stdin.end()
      }

      exif.stdout.on('data', (data) => {
        exifdata += data
      })
      exif.stderr.on('data', (data) => {
        exiferr += data
      })
      exif.on('close', (code) => {
        try {
          var parseddata = JSON.parse(exifdata)
          if (parseddata.length === 1) {
            parseddata = parseddata[0]
          }
          tryCallback(callback, null, parseddata)
          resolve(parseddata)
        } catch (_) {
          let error
          if (exiferr.length > 0) {
            error = new Error(`Exiftool failed with exit code ${code}:\n ${exiferr}`)
          } else {
            error = new Error('Could not parse exiftool output!')
          }
          error.stderr = exiferr
          error.stdout = exifdata
          error.code = code
          tryCallback(callback, error)
          reject(error)
        }
      })
    })
  })
}


export function metadataSync({ source, tags, useBufferLimit = true, maxBufferSize = 10000 }) {
  if (!source) {
    throw new Error('Undefined "source"')
  }
  let exifparams = prepareTags(tags)
  // "-j" json output
  exifparams.push('-j')

  let etdata
  if (Buffer.isBuffer(source)) {
    exifparams.push('-')
    let buf = useBufferLimit ? source.slice(0, maxBufferSize) : source
    etdata = spawnSync('exiftool', exifparams, { input: buf })
  } else if (typeof source === 'string') {
    exifparams.push(source)
    etdata = spawnSync('exiftool', exifparams)
  } else if (Array.isArray(source)) {
    exifparams = exifparams.concat(source)
    etdata = spawnSync('exiftool', exifparams)
  } else {
    throw new TypeError('"source" must be a string, [string] or Buffer')
  }

  try {
    var parseddata = JSON.parse(etdata.stdout)
    if (parseddata.length === 1) {
      parseddata = parseddata[0]
    }
    return parseddata
  } catch (e) {
    let err = new Error('Could not parse data returned by ExifTool')
    err.commandlog = {
      stdout: etdata.stdout,
      stderr: etdata.stderr,
    }
    throw err
  }
}

function tryCallback(cbfunction, error, result) {
  if (cbfunction) {
    cbfunction(error, result)
  }
}

function prepareTags(tags) {
  if (tags) {
    tags = tags.map((tagname) => {
      return '-' + tagname
    })
    return tags
  }
  return []
}
