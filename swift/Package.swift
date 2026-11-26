// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "CritterKit",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "CritterKit", targets: ["CritterKit"])
    ],
    targets: [
        .target(
            name: "CritterKit",
            resources: [.copy("Resources/pip-mobile.html")]
        )
    ]
)
