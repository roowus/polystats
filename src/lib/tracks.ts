/**
 * PolyTrack track catalog for game version 0.6.x.
 *
 * Track IDs are the SHA-256 hashes embedded in the official game client
 * (app-polytrack.kodub.com/0.6.3). Official career tracks are authored by
 * Kodub; community tracks ship with the game as featured community maps.
 */

export interface TrackInfo {
  name: string;
  id: string;
  /** Game version group the track was added in. */
  group?: string;
  environment?: 'summer' | 'winter' | 'desert';
}

export const OFFICIAL_TRACKS: TrackInfo[] = [
  { name: 'Summer 1', id: '5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038', environment: 'summer' },
  { name: 'Summer 2', id: '7eac4fee1111152cfba4d3737410264ca0f22c7f5a2211e79f0099589b8b48c0', environment: 'summer' },
  { name: 'Summer 3', id: '148826aa16ffaa23dbc453b32cff05e025ddbce1773fc7733cc13d218926515a', environment: 'summer' },
  { name: 'Summer 4', id: '93c7363dfea7fb09ca1d23b72cad5df43a30841d41c8ff25fb544c85bb03c7ae', environment: 'summer' },
  { name: 'Summer 5', id: '7603aaeffa1989a649dfaa8e1804bed4481b49df233e377687d0669899566e52', environment: 'summer' },
  { name: 'Summer 6', id: 'c117823cf6788e3247b9ee63a0c091c07352bbe352c650a7790dc6718148c2fa', environment: 'summer' },
  { name: 'Summer 7', id: 'e4bcaca3a583bb0eb62a700a69d14e89c852f0c5bf740fca76e0519ebdfc9ab1', environment: 'summer' },
  { name: 'Winter 1', id: '7239b17057127936907a805b0caa5d8c6f6c97eca9bdabf1a5312dce479629b7', environment: 'winter' },
  { name: 'Winter 2', id: '99864b635d1891d22e17eb9267527a07a92c49c0f02893729fa2ded90e3ca0f9', environment: 'winter' },
  { name: 'Winter 3', id: 'a5341fe706097cff2a3812a3fc0d87399254557328351ae8e5c882700fc1a196', environment: 'winter' },
  { name: 'Winter 4', id: '7d134c939df80c676a258266201beedd3b93572d5603f3ff4339ff8679803715', environment: 'winter' },
  { name: 'Winter 5', id: '2fe4bd46b0075cc25fc770ce50adbb68447cf493c999635bb272d231811dd264', environment: 'winter' },
  { name: 'Desert 1', id: 'c20b4ee3cd517ca6cae7e43f047548757287fbd08ba81b97892a3ef520159a34', environment: 'desert' },
  { name: 'Desert 2', id: '88647ea04145fbbbb19b55f1590e038fb0378acb2571110f02cb545cc46b0d57', environment: 'desert' },
  { name: 'Desert 3', id: '2806030c503abb41a1a26fa9a570888be14296172bb273798ef0ad87a108a2ec', environment: 'desert' },
  { name: 'Desert 4', id: '4697ea67b18c3f49b30a3d8884602115536650bc5435c88e3732e64d21a72d33', environment: 'desert' },
  { name: 'Desert 5', id: 'e5d084e06db4ab71196fea44efeceb23c8561266a78669c324a38f92581fe2db', environment: 'desert' },
];

export const COMMUNITY_TRACKS: TrackInfo[] = [
  { name: 'Amberbound', id: '4058e3616fbd79b848e70037adde4f12b4413011050aaf1c9d875cdbe2e33d68', group: '0.6.1', environment: 'summer' },
  { name: 'Star Bound', id: '76e1920a3ca015033a0b21156848def2c248c95d97ccf4aab2312a0302beefe0', group: '0.6.1', environment: 'desert' },
  { name: 'Arx Lucida', id: '520c4f511821ced30b99bceafbb02e6b7531e867126b0756e68d5e157691ef2f', group: '0.6.0', environment: 'summer' },
  { name: 'Koselig', id: '315c9e95c567cce4feca78f5ad6e8d08d0a22dac0d56061af567b43eea3d4fa8', group: '0.6.0', environment: 'winter' },
  { name: 'Sky Bound', id: 'a8913b96daceb5b615fe45aad2bb104e04eb7db140242934657111e1d1f55b89', group: '0.6.0', environment: 'summer' },
  { name: 'ShardMir', id: '66f43b2d2a17f3cee05a127040ca409795058510bd3d1ac7eee224512ec532f5', group: '0.6.0', environment: 'desert' },
  { name: '𝔖𝔱𝔢𝔦𝔫𝔴𝔞𝔩𝔩𝔟𝔲𝔯𝔤', id: 'fcbba504800751b0fb404a7cd1c9591befdf688ad5451ab2bc1f3651590cc5fc', group: '0.6.0', environment: 'summer' },
  { name: '𝕻𝖆𝖗𝖆𝖉𝖎𝖘𝖊 𝕻𝖆𝖑𝖆𝖈𝖊', id: '9ba44e8eafd0158e7e1f63e7d609db308c53f337b79e86bd0b630225451eef34', group: '0.6.0', environment: 'summer' },
  { name: 'Sunken Glyphs', id: 'b3889905b6df31cbe302e58e975988385607771605bf6e8e8e8e31b3d2dc8aa1', group: '0.6.0', environment: 'summer' },
  { name: 'Grimspyre', id: '3cd94552b12fb3a8ac45ca3a5e21a882b71b31c788989b396ab382afc69414ac', group: '0.6.0', environment: 'summer' },
  { name: 'Magenta Mines', id: '3125a5f98c3b43cf1e2604e25e8504bffd714ea5843200fa8ddf0b4c58842f16', group: '0.6.0', environment: 'summer' },
  { name: 'Cruising Altitude', id: 'a2137c20c03ad1848098b47f70417cc0b0bf169010c825dc6fb82f37066808a0', group: '0.6.0', environment: 'winter' },
  { name: 'Termite Terror', id: 'd03b9f7c10c95f40eed389458be51bdf2437febd5673d028da134e59e503c10b', group: '0.6.0', environment: 'desert' },
  { name: 'Lost at sea', id: 'a1f41dc9e884d5d4b1b6025158d70f0934dc4d892076e6c4b32dc3f3846b882e', group: '0.6.0', environment: 'summer' },
  { name: 'Frosted Fjords 寒い', id: 'b430aad5e481caa4588e30f46352b876b62f1ba0cf7730a15efd026c91a8f32e', group: '0.6.0', environment: 'winter' },
  { name: '〜✧〜Ḽevitation〜✧〜', id: '95d8f7cbe11053dbdfaeeb2f3c3d8f53f0d45fb6abeb411a74949a4cf52f427f', group: '0.6.0', environment: 'summer' },
  { name: 'Frozen Ramparts', id: '409f26b9faf55bd0ad748177bf85ebdcfc0ddd572190e7f464f38b4a60587b7e', group: '0.6.0', environment: 'winter' },
  { name: 'Tangled Cliffs', id: 'c1a2c5aef1029d7bbf946f08cd087dd25bad6e019a41694a48a0024c27627dc8', group: '0.6.0', environment: 'summer' },
  { name: 'Sludge Pipe Circuit', id: '9e53d03f4efe86834c49ce202b528d769d9aa7a6e17732d0fc56440463956a1b', group: '0.6.0', environment: 'summer' },
  { name: 'Zealot', id: 'b77ec520a40c4b38d3d7d653b747b1f8627c98709096568db22cd1bfec534ba6', group: '0.5.2', environment: 'winter' },
  { name: 'Shrouded Oasis', id: '9f827673c4132828009237a03e12ead73eae87504b4708a79c6cc0858212262d', group: '0.5.2', environment: 'desert' },
  { name: '⚙︎Cogware⚙︎', id: '9acd9aef650c4ccc41bb01f72ed44dfaa13f2e4404d2e3466f09cc1adcd9a9c0', group: '0.5.2', environment: 'summer' },
  { name: 'Land of the Rising Sun', id: '62d9989187e4508f7866e7b30aa187ddbee2595df21ff5988d7fec3589f9048d', group: '0.5.2', environment: 'summer' },
  { name: 'Midas Metropolis', id: 'b36162623435dc90a54f57590d2baa9f2d67a51cb12c393531f4b6d5e5528ebf', group: '0.5.2', environment: 'desert' },
  { name: 'Frozen In Time', id: '74ae56c0f278a19f3b69f3903198c7b9de09981133205856b53bf6bdf8db4211', group: '0.5.2', environment: 'winter' },
  { name: 'Winterfell', id: '9f4597449906aa0c2baf9a4737406385c829533e64e9e972b25b4189f4593a54', group: '0.5.2', environment: 'winter' },
  { name: 'Launch Control', id: '28b658c7d10eb8b5de6f465e034e87e40f70b37e4534d8c37d1f2af06b5a36d7', group: '0.5.2', environment: 'summer' },
  { name: 'Ghost City', id: '18b69f54f119cfb2867abded9a1574f0799a750ef94aa744d9ec8ef6b4d565ae', group: '0.5.1', environment: 'summer' },
  { name: 'MOS ESPA', id: '5ea46b3ae268a0196dcc59dabe88926400b56e29814658bfed06a284f837cefd', group: '0.5.1', environment: 'summer' },
  { name: 'Joenail Jones', id: 'ab8e1c13ddf394102be1cb04adcff8411127f1e7140a216d27a94fc19b7d0428', group: '0.5.1', environment: 'desert' },
  { name: 'Anubis', id: '86335d78d1a06d3dc81d80f84b8ac2e8f6359e9a206826e2c36f7d3f4351bea4', group: '0.5.1', environment: 'desert' },
  { name: 'Natsujō', id: 'a510bbd3341f2992a12db8a3780cb8943b6087538345d58d16602d6129742df0', group: '0.5.1', environment: 'summer' },
  { name: 'Arabica', id: '8cf99166f12cbb56a9df4e022a0e9b8c78973adb929dbf1e265ebb9f99f01163', group: '0.5.0', environment: 'desert' },
  { name: "Hyperion's Sanctuary", id: '33d99aad2ad5cef45b1d3afb8735c5229cfd98ac7cc24916e0da7283f7a545ce', group: '0.5.0', environment: 'winter' },
  { name: 'Winter Hollow', id: '5c00f2c90bcf8230183484225d1a417e45b0ad310379acfafd4c8f1dc7345dd7', group: '0.5.0', environment: 'winter' },
  { name: 'Clay temples', id: '009fad7fcc215022c6b2dbb2b6de622f07cd88d4930b8e2b6a6b74c1f5de9e44', group: '0.5.0', environment: 'desert' },
  { name: 'Las Calles', id: '1ad53694ee3e96aea27afa7b64d5c29d115de88a17b69cf3fe3f5609c52b040b', group: '0.5.0', environment: 'desert' },
  { name: 'DESERT STALLION', id: '2ed125037366052871fbb97da6e1bda49cfeb471f6b9c8fa799d520bdb3683e2', group: '0.5.0', environment: 'desert' },
  { name: 'Last Remnant', id: 'f79b1d863d50f9e3b4489988698065c6d775ff3ec90bf91085bad05ad5ec8316', group: '0.5.0', environment: 'desert' },
  { name: 'lu muvimento', id: '27429a1d1bf05770851e3919af70f47c6cd7a269c67032b084fb4345f6c271ce', group: '0.5.0', environment: 'summer' },
  { name: '90*RESET', id: 'f5c327cf09b90e4de8c3c1f9c910dbb7988cf15485d2e4beec3cc03aef408c5c', group: '0.5.0', environment: 'summer' },
  { name: 'Opal Palace - Repolished', id: '7451c2128cb96bc28195cf0ca0f83a46c3b55d78d434232d9de085dd1cf0ab36', group: '0.5.0', environment: 'winter' },
  { name: 'Sandline Ultimatum', id: '089f2aebcfe4f24d8dda3a8a630172d2bd13793e78c5247adfaa760743a377e1', group: '0.5.0', environment: 'desert' },
  { name: 'Malformations', id: '5e40f730509204c77e9c610839ed43addddbe0f8aa007168447f7fde38583905', group: '0.5.0', environment: 'desert' },
  { name: 'Snow Park', id: '191737cc4d1b74949e992d99371e5c7f5fc446a716af571c6e5449b23e9f4558', group: '0.5.0', environment: 'winter' },
  { name: 'concrete jungle', id: '39bd3fa6c3c769b298c219aee7561af35a6d856bfee14b46b0b48499e7a57ed5', group: '0.5.0', environment: 'summer' },
];

export const ALL_TRACKS: TrackInfo[] = [...OFFICIAL_TRACKS, ...COMMUNITY_TRACKS];

export function findTrack(id: string): TrackInfo | undefined {
  return ALL_TRACKS.find((t) => t.id === id);
}

export function trackName(id: string): string {
  return findTrack(id)?.name ?? id;
}
