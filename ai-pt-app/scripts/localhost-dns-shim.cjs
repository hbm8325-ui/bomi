// 이 샌드박스에는 /etc/hosts가 없어 'localhost' 이름 해석이 실패합니다(ENOTFOUND).
// 일반 PC에서는 필요 없는 우회로이며, 테스트를 돌릴 때만 NODE_OPTIONS로 불러옵니다.
//   NODE_OPTIONS=--require=./scripts/localhost-dns-shim.cjs npm test
const dns = require('dns')
const local = '127.0.0.1'
const origLookup = dns.lookup.bind(dns)
dns.lookup = function (hostname, options, callback) {
  if (hostname === 'localhost') {
    if (typeof options === 'function') return options(null, local, 4)
    if (options && options.all) return callback(null, [{ address: local, family: 4 }])
    return callback(null, local, 4)
  }
  return origLookup(hostname, options, callback)
}
const origPromise = dns.promises.lookup.bind(dns.promises)
dns.promises.lookup = async function (hostname, options) {
  if (hostname === 'localhost') {
    if (options && options.all) return [{ address: local, family: 4 }]
    return { address: local, family: 4 }
  }
  return origPromise(hostname, options)
}
